import { Effect, Exit, Cause, Option } from 'effect';
import { describe, it, expect, beforeEach } from 'vitest';
import type { StorageNotFoundError } from '../errors';
import { Storage } from '../service';
import { createInMemoryStorage } from '../testing';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createInMemoryStorage', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // -------------------------------------------------------------------------
  // upload + download round-trip
  // -------------------------------------------------------------------------

  describe('upload and download', () => {
    it('returns the same data after upload then download', async () => {
      const data = Buffer.from('hello world');

      const url = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.upload('test.txt', data, 'text/plain');
        }).pipe(Effect.provide(storage.layer)),
      );

      expect(url).toBe('memory://test.txt');

      const downloaded = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.download('test.txt');
        }).pipe(Effect.provide(storage.layer)),
      );

      expect(downloaded).toEqual(data);
    });

    it('stores multiple keys independently', async () => {
      const dataA = Buffer.from('content A');
      const dataB = Buffer.from('content B');

      await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          yield* s.upload('a.txt', dataA, 'text/plain');
          yield* s.upload('b.txt', dataB, 'text/plain');
        }).pipe(Effect.provide(storage.layer)),
      );

      const [downloadedA, downloadedB] = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return [yield* s.download('a.txt'), yield* s.download('b.txt')];
        }).pipe(Effect.provide(storage.layer)),
      );

      expect(downloadedA).toEqual(dataA);
      expect(downloadedB).toEqual(dataB);
    });
  });

  // -------------------------------------------------------------------------
  // download non-existent key
  // -------------------------------------------------------------------------

  describe('download non-existent key', () => {
    it('fails with StorageNotFoundError', async () => {
      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.download('does-not-exist');
        }).pipe(Effect.provide(storage.layer)),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const option = Cause.failureOption(exit.cause);
        expect(Option.isSome(option)).toBe(true);
        if (Option.isSome(option)) {
          expect(option.value?._tag).toBe('StorageNotFoundError');
          expect((option.value as StorageNotFoundError).key).toBe(
            'does-not-exist',
          );
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('removes the key so download fails afterwards', async () => {
      const data = Buffer.from('to be deleted');

      await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          yield* s.upload('doomed.txt', data, 'text/plain');
          yield* s.delete('doomed.txt');
        }).pipe(Effect.provide(storage.layer)),
      );

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.download('doomed.txt');
        }).pipe(Effect.provide(storage.layer)),
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // exists
  // -------------------------------------------------------------------------

  describe('exists', () => {
    it('returns true for an uploaded key', async () => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          yield* s.upload('present.txt', Buffer.from('x'), 'text/plain');
        }).pipe(Effect.provide(storage.layer)),
      );

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.exists('present.txt');
        }).pipe(Effect.provide(storage.layer)),
      );

      expect(result).toBe(true);
    });

    it('returns false for a non-existent key', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.exists('nope.txt');
        }).pipe(Effect.provide(storage.layer)),
      );

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getUrl
  // -------------------------------------------------------------------------

  describe('getUrl', () => {
    it('returns a prefixed URL for an existing key', async () => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          yield* s.upload('file.txt', Buffer.from('data'), 'text/plain');
        }).pipe(Effect.provide(storage.layer)),
      );

      const url = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.getUrl('file.txt');
        }).pipe(Effect.provide(storage.layer)),
      );

      expect(url).toBe('memory://file.txt');
    });

    it('returns empty string for a non-existent key', async () => {
      const url = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.getUrl('missing.txt');
        }).pipe(Effect.provide(storage.layer)),
      );

      expect(url).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // clear
  // -------------------------------------------------------------------------

  describe('clear', () => {
    it('wipes all stored data', async () => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          yield* s.upload('a.txt', Buffer.from('a'), 'text/plain');
          yield* s.upload('b.txt', Buffer.from('b'), 'text/plain');
        }).pipe(Effect.provide(storage.layer)),
      );

      storage.clear();

      const existsA = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.exists('a.txt');
        }).pipe(Effect.provide(storage.layer)),
      );

      const existsB = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.exists('b.txt');
        }).pipe(Effect.provide(storage.layer)),
      );

      expect(existsA).toBe(false);
      expect(existsB).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // custom baseUrl option
  // -------------------------------------------------------------------------

  describe('options', () => {
    it('uses custom baseUrl for upload URLs', async () => {
      const customStorage = createInMemoryStorage({
        baseUrl: 'https://cdn.test/',
      });

      const url = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.upload('img.png', Buffer.from('img'), 'image/png');
        }).pipe(Effect.provide(customStorage.layer)),
      );

      expect(url).toBe('https://cdn.test/img.png');
    });

    it('uses custom baseUrl for getUrl', async () => {
      const customStorage = createInMemoryStorage({
        baseUrl: 'https://cdn.test/',
      });

      await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          yield* s.upload('img.png', Buffer.from('img'), 'image/png');
        }).pipe(Effect.provide(customStorage.layer)),
      );

      const url = await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          return yield* s.getUrl('img.png');
        }).pipe(Effect.provide(customStorage.layer)),
      );

      expect(url).toBe('https://cdn.test/img.png');
    });
  });

  // -------------------------------------------------------------------------
  // getStore inspection
  // -------------------------------------------------------------------------

  describe('getStore', () => {
    it('exposes the underlying Map for inspection', async () => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const s = yield* Storage;
          yield* s.upload('key.txt', Buffer.from('val'), 'text/plain');
        }).pipe(Effect.provide(storage.layer)),
      );

      const store = storage.getStore();

      expect(store.size).toBe(1);
      expect(store.has('key.txt')).toBe(true);
      expect(store.get('key.txt')?.contentType).toBe('text/plain');
    });
  });
});
