import {
  FilesystemStorageLive,
  S3StorageLive,
  type Storage,
} from '@repo/storage';
import type { StorageConfig } from './orpc';
import type { Layer } from 'effect';

/**
 * Creates a storage layer based on the provided configuration.
 * Centralizes storage provider selection to avoid duplication.
 *
 * @param config - Storage configuration specifying the provider and its settings
 * @returns A Layer that provides the Storage service
 */
export const createStorageLayer = (
  config: StorageConfig,
): Layer.Layer<Storage, never, never> => {
  switch (config.provider) {
    case 's3':
      return S3StorageLive({
        bucket: config.bucket,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        endpoint: config.endpoint,
        publicEndpoint: config.publicEndpoint,
      });
    case 'filesystem':
      return FilesystemStorageLive({
        basePath: config.basePath,
        baseUrl: config.baseUrl,
      });
  }
};
