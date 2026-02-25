/* eslint-disable no-console -- Server entry point: lifecycle logging before/after Effect runtime */
// Configure proxy FIRST before any network requests
// eslint-disable-next-line import/order -- Must execute before any other imports make network requests
import { configureProxy } from './proxy';
configureProxy();

import { serve } from '@hono/node-server';
import {
  createFatalErrorHandlers,
  shutdownSSEPublisher,
} from '@repo/api/server';
import { verifyDbConnection } from '@repo/db/client';
import { initTelemetry, shutdownTelemetry } from '@repo/db/telemetry';
import { env } from './env';
import { shutdownRateLimiters } from './middleware/rate-limit';
import app, { db, serverRuntime } from '.';

const fatalHandlers = createFatalErrorHandlers({
  processName: 'server',
  timeoutMs: 10_000,
  cleanup: async () => {
    await shutdownSSEPublisher();
    await shutdownRateLimiters();
    await shutdownTelemetry();
  },
});

process.on('unhandledRejection', fatalHandlers.unhandledRejection);
process.on('uncaughtException', fatalHandlers.uncaughtException);

const startServer = async () => {
  initTelemetry({
    enabled: env.TELEMETRY_ENABLED,
    serviceName: env.OTEL_SERVICE_NAME ?? 'agent-engine-template-server',
    serviceVersion: env.OTEL_SERVICE_VERSION,
    environment: env.OTEL_ENV,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otlpTracesEndpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    otlpHeaders: env.OTEL_EXPORTER_OTLP_HEADERS,
    otlpTracesHeaders: env.OTEL_EXPORTER_OTLP_TRACES_HEADERS,
  });

  console.log('Verifying database connection...');

  try {
    await verifyDbConnection(db);
    console.log('Database connection verified');
  } catch (error) {
    console.error(
      'Failed to start server:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  const server = serve(
    {
      fetch: app.fetch,
      port: env.SERVER_PORT,
      hostname: env.SERVER_HOST,
    },
    (info) => {
      const host = info.family === 'IPv6' ? `[${info.address}]` : info.address;
      console.log(`
Hono
- internal server url: http://${host}:${info.port}
- external server url: ${env.PUBLIC_SERVER_URL}
- public web url: ${env.PUBLIC_WEB_URL}
- mock AI: ${env.USE_MOCK_AI}
      `);
    },
  );

  let isShuttingDown = false;
  const SHUTDOWN_TIMEOUT_MS = 30_000;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    let shutdownFailed = false;
    console.log('\nShutting down gracefully...');

    const forceTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    try {
      await new Promise<void>((resolve) => {
        server.close((error) => {
          if (error) {
            shutdownFailed = true;
            console.error('Error closing HTTP server:', error);
          } else console.log('HTTP server closed');
          resolve();
        });
      });

      await shutdownSSEPublisher();
      console.log('SSE publisher stopped');

      await shutdownRateLimiters();
      console.log('Rate limiter stores stopped');

      console.log('Disposing Effect runtime...');
      await serverRuntime.dispose();
      console.log('Effect runtime disposed');

      await db.$client.end();
      console.log('Database pool closed');

      await shutdownTelemetry();
      console.log('Telemetry exporter stopped');

      console.log('Server has stopped gracefully.');
    } catch (error) {
      shutdownFailed = true;
      console.error('Error during shutdown:', error);
    } finally {
      process.exit(shutdownFailed ? 1 : 0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

startServer();
