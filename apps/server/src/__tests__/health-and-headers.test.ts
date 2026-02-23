import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('security headers', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use(secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }));
    app.get('/', (c) => c.text('ok'));
  });

  it('sets X-Content-Type-Options header', async () => {
    const res = await app.request('/');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-Frame-Options header', async () => {
    const res = await app.request('/');
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  it('sets Strict-Transport-Security header', async () => {
    const res = await app.request('/');
    expect(res.headers.get('Strict-Transport-Security')).toBeTruthy();
  });

  it('sets X-XSS-Protection header', async () => {
    const res = await app.request('/');
    expect(res.headers.get('X-XSS-Protection')).toBe('0');
  });

  it('sets Referrer-Policy header', async () => {
    const res = await app.request('/');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
});

describe('health check endpoints', () => {
  it('GET /healthcheck returns 200 OK', async () => {
    const app = new Hono();
    app.get('/healthcheck', (c) => c.text('OK'));

    const res = await app.request('/healthcheck');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
  });

  it('GET /healthcheck/deep returns 200 with db status when healthy', async () => {
    const mockVerify = vi.fn().mockResolvedValue(undefined);

    const app = new Hono();
    app.get('/healthcheck/deep', async (c) => {
      const checks: Record<
        string,
        { status: string; latencyMs?: number; error?: string }
      > = {};

      const dbStart = Date.now();
      try {
        await mockVerify();
        checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
      } catch (err) {
        checks.database = {
          status: 'error',
          latencyMs: Date.now() - dbStart,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      const allHealthy = Object.values(checks).every(
        (ch) => ch.status === 'ok',
      );
      return c.json(
        { status: allHealthy ? 'ok' : 'degraded', checks },
        allHealthy ? 200 : 503,
      );
    });

    const res = await app.request('/healthcheck/deep');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('GET /healthcheck/deep returns 503 when db is down', async () => {
    const mockVerify = vi
      .fn()
      .mockRejectedValue(new Error('connection refused'));

    const app = new Hono();
    app.get('/healthcheck/deep', async (c) => {
      const checks: Record<
        string,
        { status: string; latencyMs?: number; error?: string }
      > = {};

      const dbStart = Date.now();
      try {
        await mockVerify();
        checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
      } catch (err) {
        checks.database = {
          status: 'error',
          latencyMs: Date.now() - dbStart,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      const allHealthy = Object.values(checks).every(
        (ch) => ch.status === 'ok',
      );
      return c.json(
        { status: allHealthy ? 'ok' : 'degraded', checks },
        allHealthy ? 200 : 503,
      );
    });

    const res = await app.request('/healthcheck/deep');
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('error');
    expect(body.checks.database.error).toBe('connection refused');
  });
});
