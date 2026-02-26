import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { corsOriginConfig } from '../config';
import { env } from '../env';
import { createApiRateLimit } from '../middleware/rate-limit';
import { api } from '../services';

const apiRateLimit = createApiRateLimit({ redisUrl: env.SERVER_REDIS_URL });

export const apiRoute = new Hono<{ Variables: { requestId: string } }>()
  .use(
    cors({
      origin: corsOriginConfig,
      credentials: true,
    }),
  )
  .use(apiRateLimit)
  .all('/*', async (c, next) => {
    const { matched, response } = await api.handler(
      c.req.raw,
      c.get('requestId'),
    );
    if (matched) {
      return c.newResponse(response.body, response);
    }
    await next();
  });

export const apiPath = `${env.PUBLIC_SERVER_API_PATH}`;
