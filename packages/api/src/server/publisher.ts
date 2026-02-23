import { EventPublisher } from '@orpc/server';
import { createClient } from 'redis';
import type { SSEEvent } from '../contracts/events';

const LOG_PREFIX = '[SSE Publisher]';
const DEFAULT_CHANNEL_PREFIX = 'cs:sse:user';

interface SSEPublisherConfig {
  redisUrl?: string;
  channelPrefix?: string;
}

const inMemoryPublisher = new EventPublisher<Record<string, SSEEvent>>();

let config: Required<Pick<SSEPublisherConfig, 'channelPrefix'>> &
  Pick<SSEPublisherConfig, 'redisUrl'> = {
  redisUrl: normalizeRedisUrl(
    process.env.SERVER_REDIS_URL ?? process.env.REDIS_URL,
  ),
  channelPrefix: process.env.SSE_REDIS_CHANNEL_PREFIX ?? DEFAULT_CHANNEL_PREFIX,
};

type RedisClient = ReturnType<typeof createClient>;

let redisPublisher: RedisClient | null = null;
let redisPublisherConnect: Promise<RedisClient> | null = null;

function normalizeRedisUrl(input: string | undefined): string | undefined {
  const trimmed = input?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function channelForUser(userId: string): string {
  return `${config.channelPrefix}:${userId}`;
}

async function closeRedisClient(client: RedisClient): Promise<void> {
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

async function ensureRedisPublisher(): Promise<RedisClient> {
  if (redisPublisher?.isOpen) {
    return redisPublisher;
  }

  if (redisPublisherConnect) {
    return redisPublisherConnect;
  }

  const redisUrl = config.redisUrl;
  if (!redisUrl) {
    throw new Error('Redis URL not configured for SSE publisher');
  }

  const client = createClient({ url: redisUrl });
  client.on('error', (error) => {
    console.error(`${LOG_PREFIX} Redis publisher error`, error);
  });

  redisPublisherConnect = client
    .connect()
    .then(() => {
      redisPublisher = client;
      redisPublisherConnect = null;
      return client;
    })
    .catch((error) => {
      redisPublisherConnect = null;
      throw error;
    });

  return redisPublisherConnect;
}

export function configureSSEPublisher(next: SSEPublisherConfig): void {
  const redisUrl =
    next.redisUrl === undefined
      ? config.redisUrl
      : normalizeRedisUrl(next.redisUrl);
  const channelPrefix =
    next.channelPrefix?.trim() ||
    config.channelPrefix ||
    DEFAULT_CHANNEL_PREFIX;
  const redisChanged = redisUrl !== config.redisUrl;

  config = { redisUrl, channelPrefix };

  if (redisChanged && redisPublisher) {
    const previous = redisPublisher;
    redisPublisher = null;
    redisPublisherConnect = null;
    void closeRedisClient(previous);
  }
}

export async function pingSSEPublisher(): Promise<void> {
  if (!config.redisUrl) return;
  const client = await ensureRedisPublisher();
  await client.ping();
}

export async function shutdownSSEPublisher(): Promise<void> {
  if (redisPublisherConnect) {
    await redisPublisherConnect.catch(() => undefined);
    redisPublisherConnect = null;
  }

  if (!redisPublisher) {
    return;
  }

  const client = redisPublisher;
  redisPublisher = null;
  await closeRedisClient(client);
}

export async function publishSSEEvent(
  userId: string,
  event: SSEEvent,
): Promise<void> {
  if (!config.redisUrl) {
    inMemoryPublisher.publish(userId, event);
    return;
  }

  const client = await ensureRedisPublisher();
  await client.publish(channelForUser(userId), JSON.stringify(event));
}

async function* subscribeViaRedis(
  userId: string,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const redisUrl = config.redisUrl;
  if (!redisUrl) {
    yield* inMemoryPublisher.subscribe(userId, { signal });
    return;
  }

  const subscriber = createClient({ url: redisUrl });
  subscriber.on('error', (error) => {
    console.error(`${LOG_PREFIX} Redis subscriber error`, error);
  });

  const channel = channelForUser(userId);
  const queue: SSEEvent[] = [];
  let waitingResolve: (() => void) | undefined;
  let isClosed = Boolean(signal?.aborted);

  const wake = () => {
    if (!waitingResolve) return;
    waitingResolve();
    waitingResolve = undefined;
  };

  const onAbort = () => {
    isClosed = true;
    wake();
  };

  const onMessage = (message: string) => {
    try {
      queue.push(JSON.parse(message) as SSEEvent);
      wake();
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to parse Redis SSE payload`, error);
    }
  };

  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    if (isClosed) return;

    await subscriber.connect();
    await subscriber.subscribe(channel, onMessage);

    while (!isClosed) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          waitingResolve = resolve;
        });
        if (isClosed) break;
      }

      while (queue.length > 0) {
        const event = queue.shift();
        if (event) {
          yield event;
        }
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);

    try {
      await subscriber.unsubscribe(channel, onMessage);
    } catch {
      // No-op: best-effort cleanup
    }

    await closeRedisClient(subscriber);
  }
}

export function subscribeToSSEEvents(
  userId: string,
  options: { signal?: AbortSignal } = {},
): AsyncIterable<SSEEvent> {
  if (!config.redisUrl) {
    return inMemoryPublisher.subscribe(userId, options);
  }
  return subscribeViaRedis(userId, options.signal);
}

export const ssePublisher = {
  publish(userId: string, event: SSEEvent): void {
    void publishSSEEvent(userId, event).catch((error) => {
      console.error(`${LOG_PREFIX} Failed to publish event`, error);
    });
  },
  subscribe(userId: string, options: { signal?: AbortSignal } = {}) {
    return subscribeToSSEEvents(userId, options);
  },
};
