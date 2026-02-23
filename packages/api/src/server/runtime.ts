import { type AI, GoogleAILive } from '@repo/ai';
import { MockAIWithLatency } from '@repo/ai/testing';
import { DatabasePolicyLive, type Policy } from '@repo/auth/policy';
import { DbLive, type Db } from '@repo/db/effect';
import { QueueLive, type Queue } from '@repo/queue';
import { ManagedRuntime, Layer, Logger } from 'effect';
import type { StorageConfig } from './orpc';
import type { DatabaseInstance } from '@repo/db/client';
import type { Storage } from '@repo/storage';
import { createStorageLayer } from './storage-factory';

/**
 * All services that can be shared across requests.
 * These are built once at server startup and reused for all requests.
 *
 * Note: CurrentUser is NOT included here - it's obtained via FiberRef
 * at runtime using withCurrentUser().
 */
export type SharedServices =
  | Db
  | Policy
  | Storage
  | Queue
  | AI;

/**
 * Configuration for creating the server runtime.
 */
export interface ServerRuntimeConfig {
  db: DatabaseInstance;
  storageConfig: StorageConfig;
  useMockAI?: boolean;
  /** Gemini API key (required when useMockAI=false) */
  geminiApiKey?: string;
}

/**
 * Creates the shared layer graph for all services.
 * This is built once at server startup.
 *
 * The layer graph:
 * - Db: Database connection
 * - Policy: Authorization service (depends on Db)
 * - Queue: Job queue service (depends on Db)
 * - Storage: File storage (S3 or filesystem)
 * - AI: LLM + TTS services (standalone)
 * - Logger: Structured logging layer
 */
export const createSharedLayers = (
  config: ServerRuntimeConfig,
): Layer.Layer<SharedServices, never, never> => {
  const dbLayer = DbLive(config.db);
  const policyLayer = DatabasePolicyLive.pipe(Layer.provide(dbLayer));
  const queueLayer = QueueLive.pipe(Layer.provide(dbLayer));
  const storageLayer = createStorageLayer(config.storageConfig);

  const aiLayer: Layer.Layer<AI> = config.useMockAI
    ? MockAIWithLatency
    : GoogleAILive({ apiKey: config.geminiApiKey! });

  const loggerLayer = Logger.pretty;

  return Layer.mergeAll(
    dbLayer,
    policyLayer,
    queueLayer,
    storageLayer,
    aiLayer,
    loggerLayer,
  );
};

/**
 * Type alias for the server runtime.
 */
export type ServerRuntime = ManagedRuntime.ManagedRuntime<
  SharedServices,
  never
>;

/**
 * Creates a shared ManagedRuntime for the server.
 * This should be created once at server startup and reused for all requests.
 *
 * @example
 * ```typescript
 * // At server startup
 * const runtime = createServerRuntime({
 *   db,
 *   geminiApiKey: env.GEMINI_API_KEY,
 *   storageConfig,
 *   useMockAI: env.USE_MOCK_AI,
 * });
 *
 * // In request handler
 * const result = await runtime.runPromise(
 *   withCurrentUser(sessionUser)(myEffect)
 * );
 * ```
 */
export const createServerRuntime = (
  config: ServerRuntimeConfig,
): ServerRuntime => {
  const layers = createSharedLayers(config);
  return ManagedRuntime.make(layers);
};
