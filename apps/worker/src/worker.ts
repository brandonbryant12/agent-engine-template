/* eslint-disable no-console -- Worker entry point: lifecycle logging before/after Effect runtime */
// Configure proxy FIRST before any network requests
// eslint-disable-next-line import/order -- Must execute before any other imports make network requests
import { configureProxy } from './proxy';
configureProxy();

import {
  configureSSEPublisher,
  createServerRuntime,
  shutdownSSEPublisher,
  ssePublisher,
} from '@repo/api/server';
import { createDb, verifyDbConnection } from '@repo/db/client';
import { initTelemetry, shutdownTelemetry } from '@repo/db/telemetry';
import { buildStorageConfig } from './config';
import { MAX_CONCURRENT_JOBS, QUEUE_DEFAULTS } from './constants';
import { env } from './env';
import { createUnifiedWorker } from './unified-worker';

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Promise Rejection:', {
    reason:
      reason instanceof Error
        ? { message: reason.message, stack: reason.stack }
        : reason,
    promise: String(promise),
  });
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

async function startWorker(): Promise<void> {
  initTelemetry({
    enabled: env.TELEMETRY_ENABLED,
    serviceName: env.OTEL_SERVICE_NAME ?? 'template-app-worker',
    serviceVersion: env.OTEL_SERVICE_VERSION,
    environment: env.OTEL_ENV,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otlpTracesEndpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    otlpHeaders: env.OTEL_EXPORTER_OTLP_HEADERS,
    otlpTracesHeaders: env.OTEL_EXPORTER_OTLP_TRACES_HEADERS,
  });

  console.log('Verifying database connection...');

  const db = createDb({ databaseUrl: env.SERVER_POSTGRES_URL });
  const storageConfig = buildStorageConfig();

  configureSSEPublisher({
    redisUrl: env.SERVER_REDIS_URL,
    channelPrefix: env.SSE_REDIS_CHANNEL_PREFIX,
  });

  try {
    await verifyDbConnection(db);
    console.log('Database connection verified');
  } catch (error) {
    console.error(
      'Failed to start worker:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  const serverRuntime = createServerRuntime({
    db,
    storageConfig,
    useMockAI: env.USE_MOCK_AI,
    geminiApiKey: env.GEMINI_API_KEY,
  });

  const worker = createUnifiedWorker({
    pollInterval: QUEUE_DEFAULTS.POLL_INTERVAL_MS,
    runtime: serverRuntime,
    publishEvent: ssePublisher.publish,
  });

  worker.start().catch((error) => {
    console.error('Worker error:', error);
    process.exit(1);
  });

  console.log(
    `Worker started\n` +
      `- polling interval: ${QUEUE_DEFAULTS.POLL_INTERVAL_MS}ms\n` +
      `- max concurrent jobs: ${MAX_CONCURRENT_JOBS}\n` +
      `- mock AI: ${env.USE_MOCK_AI}`,
  );

  let isShuttingDown = false;
  const SHUTDOWN_TIMEOUT_MS = 30_000;

  async function shutdown(): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\nShutting down gracefully...');

    const forceTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    try {
      await worker.stop();
      console.log('Worker stopped');

      console.log('Disposing Effect runtime...');
      await serverRuntime.dispose();
      console.log('Effect runtime disposed');

      await db.$client.end();
      console.log('Database pool closed');

      await shutdownSSEPublisher();
      console.log('SSE publisher stopped');

      await shutdownTelemetry();
      console.log('Telemetry exporter stopped');

      console.log('Worker has stopped gracefully.');
    } catch (error) {
      console.error('Error during shutdown:', error);
    } finally {
      process.exit(0);
    }
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startWorker();
