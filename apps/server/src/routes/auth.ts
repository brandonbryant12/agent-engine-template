import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { corsOriginConfig } from '../config';
import { env } from '../env';
import { createAuthRateLimit } from '../middleware/rate-limit';
import { auth } from '../services';

const authRateLimit = createAuthRateLimit({ redisUrl: env.SERVER_REDIS_URL });

export const authRoute = new Hono()
  .use(
    cors({
      origin: corsOriginConfig === '*' ? (origin) => origin : corsOriginConfig,
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
    }),
  )
  .use(authRateLimit)
  .on(['POST', 'GET'], '/*', (c) => auth.handler(c.req.raw));

export const authPath = `${env.PUBLIC_SERVER_API_PATH}/auth`;
