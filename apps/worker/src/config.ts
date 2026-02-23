import type { StorageConfig } from '@repo/api/server';
import { env } from './env';

export function buildStorageConfig(): StorageConfig {
  switch (env.STORAGE_PROVIDER) {
    case 'filesystem': {
      if (!env.STORAGE_PATH) {
        throw new Error('STORAGE_PATH required for filesystem provider');
      }
      return {
        provider: 'filesystem',
        basePath: env.STORAGE_PATH,
        baseUrl: env.STORAGE_BASE_URL || `${env.PUBLIC_SERVER_URL}/storage`,
      };
    }
    case 's3': {
      if (
        !env.S3_BUCKET ||
        !env.S3_REGION ||
        !env.S3_ACCESS_KEY_ID ||
        !env.S3_SECRET_ACCESS_KEY
      ) {
        throw new Error(
          'S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY required for s3 provider',
        );
      }
      return {
        provider: 's3',
        bucket: env.S3_BUCKET,
        region: env.S3_REGION,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        endpoint: env.S3_ENDPOINT,
        publicEndpoint: env.S3_PUBLIC_ENDPOINT,
      };
    }
  }
}
