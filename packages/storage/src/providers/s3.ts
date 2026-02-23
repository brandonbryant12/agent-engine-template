import { Effect, Layer } from 'effect';
import {
  StorageError,
  StorageNotFoundError,
  StorageUploadError,
} from '../errors';
import { Storage, type StorageService } from '../service';

export interface S3StorageConfig {
  readonly bucket: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly endpoint?: string;
  /** Public-facing endpoint for URL generation (e.g. browser-accessible MinIO URL). Falls back to endpoint. */
  readonly publicEndpoint?: string;
}

const makeS3Storage = (config: S3StorageConfig): StorageService => {
  const baseUrl =
    config.endpoint ?? `https://s3.${config.region}.amazonaws.com`;
  const publicBaseUrl = config.publicEndpoint ?? baseUrl;

  const internalUrl = (key: string) => `${baseUrl}/${config.bucket}/${key}`;
  const publicUrl = (key: string) => `${publicBaseUrl}/${config.bucket}/${key}`;

  const spanAttributes = (key: string) => ({
    'storage.key': key,
    'storage.provider': 's3' as const,
    'storage.bucket': config.bucket,
  });

  return {
    upload: (key, data, contentType) =>
      Effect.tryPromise({
        try: async () => {
          const url = internalUrl(key);
          const response = await fetch(url, {
            method: 'PUT',
            headers: {
              'Content-Type': contentType,
              'x-amz-acl': 'private',
            },
            body: new Uint8Array(data),
          });

          if (!response.ok) {
            throw new Error(`S3 upload failed: ${response.statusText}`);
          }

          return publicUrl(key);
        },
        catch: (cause) =>
          new StorageUploadError({
            key,
            message: `Failed to upload to S3: ${key}`,
            cause,
          }),
      }).pipe(
        Effect.withSpan('storage.upload', { attributes: spanAttributes(key) }),
      ),

    download: (key) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () => fetch(internalUrl(key)),
          catch: (cause) =>
            new StorageError({
              message: `Failed to download from S3: ${key}`,
              cause,
            }),
        });

        if (response.status === 404) {
          return yield* Effect.fail(new StorageNotFoundError({ key }));
        }

        if (!response.ok) {
          return yield* Effect.fail(
            new StorageError({
              message: `S3 download failed: ${response.statusText}`,
            }),
          );
        }

        const arrayBuffer = yield* Effect.tryPromise({
          try: () => response.arrayBuffer(),
          catch: (cause) =>
            new StorageError({
              message: `Failed to read S3 response: ${key}`,
              cause,
            }),
        });

        return Buffer.from(arrayBuffer);
      }).pipe(
        Effect.withSpan('storage.download', {
          attributes: spanAttributes(key),
        }),
      ),

    delete: (key) =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch(internalUrl(key), { method: 'DELETE' });

          if (!response.ok && response.status !== 404) {
            throw new Error(`S3 delete failed: ${response.statusText}`);
          }
        },
        catch: (cause) =>
          new StorageError({
            message: `Failed to delete from S3: ${key}`,
            cause,
          }),
      }).pipe(
        Effect.withSpan('storage.delete', { attributes: spanAttributes(key) }),
      ),

    getUrl: (key) =>
      Effect.succeed(publicUrl(key)).pipe(
        Effect.withSpan('storage.getUrl', { attributes: spanAttributes(key) }),
      ),

    exists: (key) =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch(internalUrl(key), { method: 'HEAD' });
          return response.ok;
        },
        catch: () =>
          new StorageError({ message: `Failed to check S3 object: ${key}` }),
      }).pipe(
        Effect.withSpan('storage.exists', { attributes: spanAttributes(key) }),
      ),
  };
};

export const S3StorageLive = (config: S3StorageConfig): Layer.Layer<Storage> =>
  Layer.sync(Storage, () => makeS3Storage(config));
