import { Layer, Effect } from 'effect';
import { Storage, type StorageService, StorageNotFoundError } from '..';

export interface MockStorageOptions {
  delay?: number;
  baseUrl?: string;
}

const withDelay = <A, E>(
  delay: number | undefined,
  effect: Effect.Effect<A, E>,
) => (delay ? Effect.zipRight(Effect.sleep(delay), effect) : effect);

/**
 * Create an in-memory storage layer for testing.
 * Data persists across calls within the same instance; call `clear()` between tests.
 */
export function createInMemoryStorage(options: MockStorageOptions = {}) {
  const store = new Map<string, { data: Buffer; contentType: string }>();
  const baseUrl = options.baseUrl ?? 'memory://';

  const service: StorageService = {
    upload: (key, data, contentType) =>
      withDelay(
        options.delay,
        Effect.sync(() => {
          store.set(key, { data, contentType });
          return `${baseUrl}${key}`;
        }),
      ),

    download: (key) =>
      withDelay(
        options.delay,
        Effect.suspend(() => {
          const entry = store.get(key);
          return entry
            ? Effect.succeed(entry.data)
            : Effect.fail(new StorageNotFoundError({ key }));
        }),
      ),

    delete: (key) =>
      withDelay(
        options.delay,
        Effect.sync(() => {
          store.delete(key);
        }),
      ),

    getUrl: (key) =>
      withDelay(
        options.delay,
        Effect.sync(() => (store.has(key) ? `${baseUrl}${key}` : '')),
      ),

    exists: (key) =>
      withDelay(
        options.delay,
        Effect.sync(() => store.has(key)),
      ),
  };

  return {
    layer: Layer.succeed(Storage, service),
    clear: () => store.clear(),
    getStore: () => store,
  };
}

/**
 * Create a simple mock storage layer.
 * Unlike createInMemoryStorage, this does not persist data between calls.
 */
export function createMockStorage(
  options: MockStorageOptions = {},
): Layer.Layer<Storage> {
  const baseUrl = options.baseUrl ?? 'mock://';

  const service: StorageService = {
    upload: (key) =>
      withDelay(options.delay, Effect.succeed(`${baseUrl}${key}`)),

    download: () =>
      withDelay(options.delay, Effect.succeed(Buffer.from('mock content'))),

    delete: () => withDelay(options.delay, Effect.void),

    getUrl: (key) =>
      withDelay(options.delay, Effect.succeed(`${baseUrl}${key}`)),

    exists: () => withDelay(options.delay, Effect.succeed(true)),
  };

  return Layer.succeed(Storage, service);
}

export const MockStorageLive = createMockStorage();
