import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { storageConfig } from '../services';

export const staticRoute = new Hono();

if (storageConfig.provider === 'filesystem') {
  staticRoute.use(
    '/*',
    serveStatic({
      root: storageConfig.basePath,
      rewriteRequestPath: (path) => path.replace('/storage', ''),
    }),
  );
}

export const staticPath = '/storage';
