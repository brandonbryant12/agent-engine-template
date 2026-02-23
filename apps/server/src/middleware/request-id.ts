import { randomUUID } from 'crypto';
import type { MiddlewareHandler } from 'hono';

const HEADER_NAME = 'x-request-id';

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header(HEADER_NAME)?.trim();
  const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();

  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);

  await next();
};
