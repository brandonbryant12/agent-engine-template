import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalErrorHandler } from '../error-handler';

describe('globalErrorHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves HTTPException response status, headers, and body', async () => {
    const app = new Hono();
    app.onError(globalErrorHandler);
    app.get('/auth', () => {
      throw new HTTPException(401, {
        res: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="template-app"',
            'X-Debug-Source': 'framework',
          },
        }),
      });
    });

    const res = await app.request('/auth');

    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe(
      'Bearer realm="template-app"',
    );
    expect(res.headers.get('X-Debug-Source')).toBe('framework');
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns generic 500 and logs for non-HTTPException errors', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const app = new Hono();
    app.onError(globalErrorHandler);
    app.get('/boom', () => {
      throw new Error('unexpected');
    });

    const res = await app.request('/boom');

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'Internal Server Error',
    });
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '\t[ERROR]',
      expect.stringContaining('unexpected'),
    );
  });
});
