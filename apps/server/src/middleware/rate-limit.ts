import { isIP } from 'node:net';
import { getConnInfo } from '@hono/node-server/conninfo';
import { createClient } from 'redis';
import type { Context, MiddlewareHandler } from 'hono';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyGenerator?: (c: Context) => string;
  cleanupIntervalMs?: number;
  redisUrl?: string;
  keyPrefix?: string;
  /**
   * Optional store override for tests or custom integrations.
   */
  store?: RateLimitStore;
  /**
   * Optional callback when the primary store fails and fallback is used.
   */
  onStoreError?: (error: unknown) => void;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

interface RateLimitSnapshot {
  count: number;
  resetAt: number;
}

interface RateLimitStore {
  consume: (
    key: string,
    windowMs: number,
    now: number,
  ) => Promise<RateLimitSnapshot> | RateLimitSnapshot;
  shutdown?: () => Promise<void>;
}

interface TrustedProxyConfig {
  trustProxy: boolean;
  trustedHops: number;
  trustedProxyMatchers: readonly string[];
}

interface RateLimitIdentityInput {
  remoteAddress?: string;
  forwardedHeader?: string;
  realIpHeader?: string;
  config?: TrustedProxyConfig;
}

const DEFAULT_KEY_PREFIX = 'cs:rate-limit';
const LOG_PREFIX = '[RateLimit]';
const TRUST_PROXY_ENV = 'RATE_LIMIT_TRUST_PROXY';
const TRUSTED_HOPS_ENV = 'RATE_LIMIT_TRUSTED_HOPS';
const TRUSTED_PROXIES_ENV = 'RATE_LIMIT_TRUSTED_PROXIES';

const REDIS_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end

local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  ttl = tonumber(ARGV[1])
  redis.call('PEXPIRE', KEYS[1], ttl)
end

return { current, ttl }
`;

const redisBackedStores = new Set<RateLimitStore>();

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseTrustedHops(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function normalizeIp(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const withoutZone = trimmed.split('%')[0] ?? trimmed;
  const unwrapped =
    withoutZone.startsWith('[') && withoutZone.endsWith(']')
      ? withoutZone.slice(1, -1)
      : withoutZone;

  if (unwrapped.toLowerCase().startsWith('::ffff:')) {
    const mapped = unwrapped.slice('::ffff:'.length);
    if (isIP(mapped) === 4) {
      return mapped;
    }
  }

  if (isIP(unwrapped)) {
    return unwrapped;
  }

  return undefined;
}

function isLoopbackAddress(address: string): boolean {
  return address === '127.0.0.1' || address === '::1';
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    return (
      address.startsWith('10.') ||
      address.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
    );
  }

  if (isIP(address) === 6) {
    const lowered = address.toLowerCase();
    return lowered.startsWith('fc') || lowered.startsWith('fd');
  }

  return false;
}

function isTrustedProxyAddress(
  address: string,
  trustedProxyMatchers: readonly string[],
): boolean {
  for (const matcher of trustedProxyMatchers) {
    if (matcher === '*') return true;
    if (matcher === 'loopback' && isLoopbackAddress(address)) return true;
    if (matcher === 'private' && isPrivateAddress(address)) return true;
    if (matcher === address) return true;
  }

  return false;
}

function parseForwardedHeader(header: string | undefined): string[] {
  if (!header) return [];

  const ips = header
    .split(',')
    .map((candidate) => normalizeIp(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));

  return ips;
}

function getServerRemoteAddress(c: Context): string | undefined {
  try {
    return normalizeIp(getConnInfo(c).remote.address);
  } catch {
    return undefined;
  }
}

function buildTrustedProxyConfig(): TrustedProxyConfig {
  const trustProxy = parseBoolean(process.env[TRUST_PROXY_ENV], true);
  const trustedHops = parseTrustedHops(process.env[TRUSTED_HOPS_ENV], 1);
  const trustedProxyMatchers = (
    process.env[TRUSTED_PROXIES_ENV] ?? 'loopback,private'
  )
    .split(',')
    .map((matcher) => matcher.trim().toLowerCase())
    .filter(Boolean);

  return {
    trustProxy,
    trustedHops,
    trustedProxyMatchers,
  };
}

const trustedProxyConfig = buildTrustedProxyConfig();

function selectClientIpFromForwardedChain(
  forwardedIps: readonly string[],
  trustedHops: number,
): string | undefined {
  if (forwardedIps.length === 0) return undefined;
  const index = forwardedIps.length - trustedHops;
  if (index < 0) return undefined;
  return forwardedIps[index];
}

export function resolveRateLimitIdentity(input: RateLimitIdentityInput): string {
  const config = input.config ?? trustedProxyConfig;
  const remoteAddress = normalizeIp(input.remoteAddress);

  if (!config.trustProxy) {
    return remoteAddress ?? 'unknown';
  }

  const forwardedIps = parseForwardedHeader(input.forwardedHeader);
  const realIp = normalizeIp(input.realIpHeader);

  // In test/local harnesses, socket-derived remote address may be unavailable.
  if (!remoteAddress) {
    return realIp ?? forwardedIps[0] ?? 'unknown';
  }

  if (!isTrustedProxyAddress(remoteAddress, config.trustedProxyMatchers)) {
    return remoteAddress;
  }

  const forwardedCandidate = selectClientIpFromForwardedChain(
    forwardedIps,
    config.trustedHops,
  );

  if (forwardedCandidate) {
    return forwardedCandidate;
  }

  return realIp ?? remoteAddress;
}

function createInMemoryStore(cleanupIntervalMs: number): RateLimitStore {
  const store = new Map<string, WindowEntry>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, cleanupIntervalMs);
  cleanupTimer.unref();

  return {
    consume: (key, windowMs, now) => {
      let entry = store.get(key);

      if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        store.set(key, entry);
      }

      entry.count += 1;
      return { count: entry.count, resetAt: entry.resetAt };
    },
  };
}

function createRedisStore(redisUrl: string, keyPrefix: string): RateLimitStore {
  const client = createClient({ url: redisUrl });
  let connectPromise: Promise<unknown> | null = null;

  client.on('error', (error) => {
    console.error(`${LOG_PREFIX} Redis client error`, error);
  });

  const ensureConnected = async () => {
    if (client.isOpen) return;
    if (connectPromise) return connectPromise;

    connectPromise = client.connect().finally(() => {
      connectPromise = null;
    });

    await connectPromise;
  };

  return {
    consume: async (key, windowMs, now) => {
      await ensureConnected();

      const raw = await client.eval(REDIS_WINDOW_SCRIPT, {
        keys: [`${keyPrefix}:${key}`],
        arguments: [String(windowMs)],
      });

      const tuple = Array.isArray(raw) ? raw : [];
      const count = toNumber(tuple[0], 1);
      const ttlMs = Math.max(0, toNumber(tuple[1], windowMs));

      return {
        count,
        resetAt: now + (ttlMs > 0 ? ttlMs : windowMs),
      };
    },
    shutdown: async () => {
      if (connectPromise) {
        await connectPromise.catch(() => undefined);
        connectPromise = null;
      }

      if (!client.isOpen) {
        return;
      }

      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    },
  };
}

function createResilientStore(
  primary: RateLimitStore,
  fallback: RateLimitStore,
  onError?: (error: unknown) => void,
): RateLimitStore {
  return {
    consume: async (key, windowMs, now) => {
      try {
        return await primary.consume(key, windowMs, now);
      } catch (error) {
        onError?.(error);
        return fallback.consume(key, windowMs, now);
      }
    },
    shutdown: async () => {
      await Promise.all([
        primary.shutdown?.().catch(() => undefined),
        fallback.shutdown?.().catch(() => undefined),
      ]);
    },
  };
}

export const rateLimiter = (opts: RateLimitOptions): MiddlewareHandler => {
  const {
    limit,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    cleanupIntervalMs = 60_000,
    redisUrl,
    keyPrefix = DEFAULT_KEY_PREFIX,
    store,
    onStoreError,
  } = opts;

  const fallbackStore = createInMemoryStore(cleanupIntervalMs);
  let loggedStoreFailure = false;

  const activeStore: RateLimitStore = store
    ? store
    : redisUrl
      ? createResilientStore(
          createRedisStore(redisUrl, keyPrefix),
          fallbackStore,
          (error) => {
            if (!loggedStoreFailure) {
              loggedStoreFailure = true;
              console.error(
                `${LOG_PREFIX} Primary store failed, using in-memory fallback`,
                error,
              );
            }
            onStoreError?.(error);
          },
        )
      : fallbackStore;

  if (!store && redisUrl) {
    redisBackedStores.add(activeStore);
  }

  return async (c, next) => {
    const key = keyGenerator(c);
    const now = Date.now();
    const snapshot = await activeStore.consume(key, windowMs, now);

    const remaining = Math.max(0, limit - snapshot.count);
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(snapshot.resetAt / 1000)));

    if (snapshot.count > limit) {
      c.header(
        'Retry-After',
        String(Math.max(1, Math.ceil((snapshot.resetAt - now) / 1000))),
      );
      return c.json({ error: 'Too many requests' }, 429);
    }

    await next();
  };
};

function defaultKeyGenerator(c: Context): string {
  return resolveRateLimitIdentity({
    remoteAddress: getServerRemoteAddress(c),
    forwardedHeader: c.req.header('x-forwarded-for'),
    realIpHeader: c.req.header('x-real-ip'),
  });
}

export async function shutdownRateLimiters(): Promise<void> {
  const stores = [...redisBackedStores];
  redisBackedStores.clear();

  await Promise.all(stores.map((s) => s.shutdown?.().catch(() => undefined)));
}

export const createAuthRateLimit = (
  opts: Pick<RateLimitOptions, 'redisUrl'> = {},
) =>
  rateLimiter({
    limit: 20,
    windowMs: 15 * 60 * 1000,
    redisUrl: opts.redisUrl,
    keyPrefix: `${DEFAULT_KEY_PREFIX}:auth`,
  });

export const createApiRateLimit = (
  opts: Pick<RateLimitOptions, 'redisUrl'> = {},
) =>
  rateLimiter({
    limit: 200,
    windowMs: 60 * 1000,
    redisUrl: opts.redisUrl,
    keyPrefix: `${DEFAULT_KEY_PREFIX}:api`,
  });

export const authRateLimit = createAuthRateLimit();
export const apiRateLimit = createApiRateLimit();
