import type { StorageConfig } from '@repo/api/server';
import { env } from './env';

export const buildStorageConfig = (): StorageConfig => {
  if (env.STORAGE_PROVIDER === 'filesystem') {
    if (!env.STORAGE_PATH) {
      throw new Error('STORAGE_PATH required for filesystem provider');
    }
    return {
      provider: 'filesystem',
      basePath: env.STORAGE_PATH,
      baseUrl: env.STORAGE_BASE_URL ?? `${env.PUBLIC_SERVER_URL}/storage`,
    };
  }

  if (env.STORAGE_PROVIDER === 's3') {
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

  return {
    provider: 'filesystem',
    basePath: './uploads',
    baseUrl: `${env.PUBLIC_SERVER_URL}/storage`,
  };
};

/**
 * CORS origins. Set CORS_ORIGINS=* for fully permissive mode (reflects
 * any requesting origin). Otherwise falls back to PUBLIC_WEB_URL.
 */
export const corsOriginConfig: string[] | '*' = (() => {
  if (env.CORS_ORIGINS === '*') return '*';
  const origins = [env.PUBLIC_WEB_URL];
  if (env.CORS_ORIGINS) {
    origins.push(...env.CORS_ORIGINS.split(',').map((s) => s.trim()));
  }
  return origins.map((url) => {
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
  });
})();
