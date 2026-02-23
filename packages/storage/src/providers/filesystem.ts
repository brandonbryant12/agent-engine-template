import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Effect, Layer } from 'effect';
import {
  StorageError,
  StorageNotFoundError,
  StorageUploadError,
} from '../errors';
import { Storage, type StorageService } from '../service';

export interface FilesystemStorageConfig {
  readonly basePath: string;
  readonly baseUrl: string;
}

const makeFilesystemStorage = (
  config: FilesystemStorageConfig,
): StorageService => {
  const filePath = (key: string) => path.join(config.basePath, key);

  const spanAttributes = (key: string) => ({
    'storage.key': key,
    'storage.provider': 'filesystem' as const,
  });

  return {
    upload: (key, data) =>
      Effect.gen(function* () {
        const dest = filePath(key);
        const dir = path.dirname(dest);

        yield* Effect.tryPromise({
          try: () => fs.mkdir(dir, { recursive: true }),
          catch: (cause) =>
            new StorageUploadError({
              key,
              message: `Failed to create directory: ${dir}`,
              cause,
            }),
        });

        yield* Effect.tryPromise({
          try: () => fs.writeFile(dest, data),
          catch: (cause) =>
            new StorageUploadError({
              key,
              message: `Failed to write file: ${dest}`,
              cause,
            }),
        });

        return `${config.baseUrl}/${key}`;
      }).pipe(
        Effect.withSpan('storage.upload', { attributes: spanAttributes(key) }),
      ),

    download: (key) =>
      Effect.tryPromise({
        try: () => fs.readFile(filePath(key)),
        catch: (cause) => {
          if (isEnoent(cause)) {
            return new StorageNotFoundError({ key });
          }
          return new StorageError({
            message: `Failed to read file: ${key}`,
            cause,
          });
        },
      }).pipe(
        Effect.withSpan('storage.download', {
          attributes: spanAttributes(key),
        }),
      ),

    delete: (key) =>
      Effect.tryPromise({
        try: () => fs.unlink(filePath(key)),
        catch: (cause) =>
          new StorageError({
            message: `Failed to delete file: ${key}`,
            cause,
          }),
      }).pipe(
        Effect.withSpan('storage.delete', { attributes: spanAttributes(key) }),
      ),

    getUrl: (key) =>
      Effect.succeed(`${config.baseUrl}/${key}`).pipe(
        Effect.withSpan('storage.getUrl', { attributes: spanAttributes(key) }),
      ),

    exists: (key) =>
      Effect.promise(() =>
        fs
          .access(filePath(key))
          .then(() => true)
          .catch(() => false),
      ).pipe(
        Effect.withSpan('storage.exists', { attributes: spanAttributes(key) }),
      ),
  };
};

const isEnoent = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';

export const FilesystemStorageLive = (
  config: FilesystemStorageConfig,
): Layer.Layer<Storage> =>
  Layer.sync(Storage, () => makeFilesystemStorage(config));
