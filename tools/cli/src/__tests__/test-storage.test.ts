import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Storage, FilesystemStorageLive } from '@repo/storage';
import { Effect } from 'effect';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StorageNotFoundError } from '@repo/storage';

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-storage-test-'));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

const makeLayer = () =>
  FilesystemStorageLive({ basePath: tempDir, baseUrl: `file://${tempDir}` });

describe('Storage CRUD lifecycle', () => {
  const TEST_KEY = 'test/hello.txt';
  const TEST_DATA = Buffer.from('hello world');

  it('upload returns a URL containing the key', async () => {
    const layer = makeLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.upload(TEST_KEY, TEST_DATA, 'text/plain');
      }).pipe(Effect.provide(layer)),
    );

    expect(result).toContain(TEST_KEY);
  });

  it('download returns the same content that was uploaded', async () => {
    const layer = makeLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.upload(TEST_KEY, TEST_DATA, 'text/plain');
        return yield* storage.download(TEST_KEY);
      }).pipe(Effect.provide(layer)),
    );

    expect(result.toString()).toBe(TEST_DATA.toString());
  });

  it('exists returns true after upload, false after delete', async () => {
    const layer = makeLayer();
    const { before, after } = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.upload(TEST_KEY, TEST_DATA, 'text/plain');
        const before = yield* storage.exists(TEST_KEY);
        yield* storage.delete(TEST_KEY);
        const after = yield* storage.exists(TEST_KEY);
        return { before, after };
      }).pipe(Effect.provide(layer)),
    );

    expect(before).toBe(true);
    expect(after).toBe(false);
  });

  it('getUrl returns a URL for an uploaded file', async () => {
    const layer = makeLayer();
    const url = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.upload(TEST_KEY, TEST_DATA, 'text/plain');
        return yield* storage.getUrl(TEST_KEY);
      }).pipe(Effect.provide(layer)),
    );

    expect(url).toContain(TEST_KEY);
  });

  it('download fails with StorageNotFoundError for missing key', async () => {
    const layer = makeLayer();

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.download('nonexistent/file.txt');
      }).pipe(Effect.provide(layer)),
    );

    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure' && exit.cause._tag === 'Fail') {
      const error = exit.cause.error;
      expect(error?._tag).toBe('StorageNotFoundError');
      expect((error as StorageNotFoundError).key).toBe('nonexistent/file.txt');
    }
  });
});
