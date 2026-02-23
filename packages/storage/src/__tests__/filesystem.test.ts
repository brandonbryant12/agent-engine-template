import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Effect, Exit, Cause } from 'effect';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FilesystemStorageLive } from '../providers/filesystem';
import { Storage } from '../service';

describe('FilesystemStorage', () => {
  let tmpDir: string;
  const baseUrl = 'http://localhost:3000/files';

  const makeLayer = () => FilesystemStorageLive({ basePath: tmpDir, baseUrl });

  const run = <A, E>(effect: Effect.Effect<A, E, Storage>) =>
    Effect.runPromise(effect.pipe(Effect.provide(makeLayer())));

  const runExit = <A, E>(effect: Effect.Effect<A, E, Storage>) =>
    Effect.runPromiseExit(effect.pipe(Effect.provide(makeLayer())));

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('upload', () => {
    it('writes file and returns URL', async () => {
      const url = await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.upload(
            'test.txt',
            Buffer.from('hello'),
            'text/plain',
          );
        }),
      );

      expect(url).toBe(`${baseUrl}/test.txt`);

      const written = await fs.readFile(path.join(tmpDir, 'test.txt'), 'utf-8');
      expect(written).toBe('hello');
    });

    it('creates nested directories', async () => {
      await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          yield* storage.upload(
            'a/b/c/deep.txt',
            Buffer.from('nested'),
            'text/plain',
          );
        }),
      );

      const written = await fs.readFile(
        path.join(tmpDir, 'a/b/c/deep.txt'),
        'utf-8',
      );
      expect(written).toBe('nested');
    });

    it('overwrites existing file', async () => {
      const key = 'overwrite.txt';
      await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          yield* storage.upload(key, Buffer.from('first'), 'text/plain');
          yield* storage.upload(key, Buffer.from('second'), 'text/plain');
        }),
      );

      const written = await fs.readFile(path.join(tmpDir, key), 'utf-8');
      expect(written).toBe('second');
    });

    it('fails with StorageUploadError on write failure', async () => {
      // Point to a non-writable path
      const badLayer = FilesystemStorageLive({
        basePath: '/dev/null/impossible',
        baseUrl,
      });

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const storage = yield* Storage;
          yield* storage.upload('test.txt', Buffer.from('data'), 'text/plain');
        }).pipe(Effect.provide(badLayer)),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause);
        expect(error._tag).toBe('Some');
        if (error._tag === 'Some') {
          expect(error.value._tag).toBe('StorageUploadError');
        }
      }
    });
  });

  describe('download', () => {
    it('returns file contents', async () => {
      await fs.writeFile(path.join(tmpDir, 'read-me.txt'), 'file content');

      const data = await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.download('read-me.txt');
        }),
      );

      expect(data.toString()).toBe('file content');
    });

    it('preserves binary data', async () => {
      const binary = Buffer.from([0x00, 0x01, 0xff, 0xfe]);
      await fs.writeFile(path.join(tmpDir, 'binary.bin'), binary);

      const data = await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.download('binary.bin');
        }),
      );

      expect(Buffer.compare(data, binary)).toBe(0);
    });

    it('fails with StorageNotFoundError for missing file', async () => {
      const exit = await runExit(
        Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.download('does-not-exist.txt');
        }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause);
        expect(error._tag).toBe('Some');
        if (error._tag === 'Some') {
          expect(error.value._tag).toBe('StorageNotFoundError');
          expect(error.value.key).toBe('does-not-exist.txt');
        }
      }
    });
  });

  describe('delete', () => {
    it('removes the file', async () => {
      const filePath = path.join(tmpDir, 'to-delete.txt');
      await fs.writeFile(filePath, 'delete me');

      await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          yield* storage.delete('to-delete.txt');
        }),
      );

      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('fails with StorageError when file does not exist', async () => {
      const exit = await runExit(
        Effect.gen(function* () {
          const storage = yield* Storage;
          yield* storage.delete('ghost.txt');
        }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause);
        expect(error._tag).toBe('Some');
        if (error._tag === 'Some') {
          expect(error.value._tag).toBe('StorageError');
        }
      }
    });
  });

  describe('getUrl', () => {
    it('returns constructed URL for key', async () => {
      const url = await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.getUrl('audio/episode-1.mp3');
        }),
      );

      expect(url).toBe(`${baseUrl}/audio/episode-1.mp3`);
    });
  });

  describe('exists', () => {
    it('returns true when file exists', async () => {
      await fs.writeFile(path.join(tmpDir, 'here.txt'), 'present');

      const result = await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.exists('here.txt');
        }),
      );

      expect(result).toBe(true);
    });

    it('returns false when file does not exist', async () => {
      const result = await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.exists('not-here.txt');
        }),
      );

      expect(result).toBe(false);
    });
  });

  describe('roundtrip', () => {
    it('upload then download preserves content', async () => {
      const content = Buffer.from('roundtrip data 🎉');

      const downloaded = await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          yield* storage.upload('round.txt', content, 'text/plain');
          return yield* storage.download('round.txt');
        }),
      );

      expect(downloaded.toString()).toBe(content.toString());
    });

    it('upload then exists returns true', async () => {
      const result = await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          yield* storage.upload('check.txt', Buffer.from('x'), 'text/plain');
          return yield* storage.exists('check.txt');
        }),
      );

      expect(result).toBe(true);
    });

    it('upload then delete then exists returns false', async () => {
      const result = await run(
        Effect.gen(function* () {
          const storage = yield* Storage;
          yield* storage.upload('temp.txt', Buffer.from('x'), 'text/plain');
          yield* storage.delete('temp.txt');
          return yield* storage.exists('temp.txt');
        }),
      );

      expect(result).toBe(false);
    });
  });
});
