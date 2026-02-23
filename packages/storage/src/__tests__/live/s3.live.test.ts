/**
 * Live integration tests for S3 storage service.
 *
 * These tests are SKIPPED by default and only run when S3 env vars are set.
 * Use them to verify:
 * - S3/R2/MinIO configuration before deployment
 * - API connectivity and credentials
 * - Real storage operations
 *
 * Required environment variables:
 * - S3_BUCKET: The bucket name
 * - S3_REGION: The AWS region (e.g., 'us-east-1')
 * - S3_ACCESS_KEY_ID: AWS access key ID
 * - S3_SECRET_ACCESS_KEY: AWS secret access key
 * - S3_ENDPOINT (optional): Custom endpoint for R2/MinIO
 *
 * Run with: S3_BUCKET=xxx S3_REGION=xxx S3_ACCESS_KEY_ID=xxx S3_SECRET_ACCESS_KEY=xxx pnpm --filter @repo/storage test:live:s3
 */
import { Effect } from 'effect';
import { describe, it, expect, afterAll } from 'vitest';
import { S3StorageLive, Storage } from '../../index';
import { liveTestEnv } from './env';

const {
  S3_BUCKET,
  S3_REGION,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT,
} = liveTestEnv;

const hasS3Config =
  S3_BUCKET && S3_REGION && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY;

// Test key prefix to avoid conflicts and make cleanup easier
const TEST_KEY_PREFIX = `live-test-${Date.now()}`;

describe.skipIf(!hasS3Config)('S3 Storage Live Integration', () => {
  const layer = S3StorageLive({
    bucket: S3_BUCKET!,
    region: S3_REGION!,
    accessKeyId: S3_ACCESS_KEY_ID!,
    secretAccessKey: S3_SECRET_ACCESS_KEY!,
    endpoint: S3_ENDPOINT,
  });

  // Track keys created during tests for cleanup
  const createdKeys: string[] = [];

  const createTestKey = (suffix: string) => {
    const key = `${TEST_KEY_PREFIX}/${suffix}`;
    createdKeys.push(key);
    return key;
  };

  // Cleanup after all tests
  afterAll(async () => {
    for (const key of createdKeys) {
      try {
        const effect = Effect.gen(function* () {
          const storage = yield* Storage;
          yield* storage.delete(key);
        }).pipe(Effect.provide(layer));

        await Effect.runPromise(effect);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('upload', () => {
    it('can upload a file', async () => {
      const key = createTestKey('upload-test.txt');
      const content = Buffer.from('Hello, World!');

      const effect = Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.upload(key, content, 'text/plain');
      }).pipe(Effect.provide(layer));

      const url = await Effect.runPromise(effect);

      expect(url).toBeDefined();
      expect(url).toContain(key);
    });

    it('can upload binary data', async () => {
      const key = createTestKey('binary-test.bin');
      // Create some binary data
      const content = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);

      const effect = Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.upload(key, content, 'application/octet-stream');
      }).pipe(Effect.provide(layer));

      const url = await Effect.runPromise(effect);

      expect(url).toBeDefined();
    });

    it('can upload larger files', async () => {
      const key = createTestKey('large-test.txt');
      // Create a 1MB file
      const content = Buffer.alloc(1024 * 1024, 'x');

      const effect = Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.upload(key, content, 'text/plain');
      }).pipe(Effect.provide(layer));

      const url = await Effect.runPromise(effect);

      expect(url).toBeDefined();
    });
  });

  describe('download', () => {
    it('can download a file', async () => {
      const key = createTestKey('download-test.txt');
      const originalContent = Buffer.from('Download test content');

      // First upload
      const uploadEffect = Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.upload(key, originalContent, 'text/plain');
      }).pipe(Effect.provide(layer));

      await Effect.runPromise(uploadEffect);

      // Then download
      const downloadEffect = Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.download(key);
      }).pipe(Effect.provide(layer));

      const downloaded = await Effect.runPromise(downloadEffect);

      expect(downloaded).toBeInstanceOf(Buffer);
      expect(downloaded.toString()).toBe(originalContent.toString());
    });

    it('handles missing file (404)', async () => {
      const key = `${TEST_KEY_PREFIX}/non-existent-file-${Date.now()}.txt`;

      const effect = Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.download(key);
      }).pipe(Effect.provide(layer));

      const result = await Effect.runPromiseExit(effect);

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error._tag).toBe('StorageNotFoundError');
        }
      }
    });
  });

  describe('delete', () => {
    it('can delete a file', async () => {
      const key = createTestKey('delete-test.txt');
      const content = Buffer.from('To be deleted');

      // Upload first
      const uploadEffect = Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.upload(key, content, 'text/plain');
      }).pipe(Effect.provide(layer));

      await Effect.runPromise(uploadEffect);

      // Delete
      const deleteEffect = Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.delete(key);
      }).pipe(Effect.provide(layer));

      await Effect.runPromise(deleteEffect);

      // Verify it's gone
      const checkEffect = Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.exists(key);
      }).pipe(Effect.provide(layer));

      const exists = await Effect.runPromise(checkEffect);
      expect(exists).toBe(false);

      // Remove from cleanup list since already deleted
      const index = createdKeys.indexOf(key);
      if (index > -1) createdKeys.splice(index, 1);
    });

    it('handles deleting non-existent file (idempotent)', async () => {
      const key = `${TEST_KEY_PREFIX}/non-existent-delete-${Date.now()}.txt`;

      const effect = Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.delete(key);
      }).pipe(Effect.provide(layer));

      // Should not throw for non-existent file
      await expect(Effect.runPromise(effect)).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('returns true for existing file', async () => {
      const key = createTestKey('exists-test.txt');
      const content = Buffer.from('Existence test');

      // Upload first
      const uploadEffect = Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.upload(key, content, 'text/plain');
      }).pipe(Effect.provide(layer));

      await Effect.runPromise(uploadEffect);

      // Check exists
      const checkEffect = Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.exists(key);
      }).pipe(Effect.provide(layer));

      const exists = await Effect.runPromise(checkEffect);
      expect(exists).toBe(true);
    });

    it('returns false for non-existent file', async () => {
      const key = `${TEST_KEY_PREFIX}/non-existent-exists-${Date.now()}.txt`;

      const effect = Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.exists(key);
      }).pipe(Effect.provide(layer));

      const exists = await Effect.runPromise(effect);
      expect(exists).toBe(false);
    });
  });

  describe('getUrl', () => {
    it('returns URL for a key', async () => {
      const key = createTestKey('url-test.txt');

      const effect = Effect.gen(function* () {
        const storage = yield* Storage;
        return yield* storage.getUrl(key);
      }).pipe(Effect.provide(layer));

      const url = await Effect.runPromise(effect);

      expect(url).toBeDefined();
      expect(url).toContain(key);
      expect(url).toContain(S3_BUCKET);
    });
  });

  describe('roundtrip', () => {
    it('can upload and download preserving content', async () => {
      const key = createTestKey('roundtrip-test.json');
      const originalData = {
        name: 'Test Payload',
        createdAt: new Date().toISOString(),
        tags: ['test', 'live', 's3'],
        metadata: {
          size: 1024,
          format: 'json',
        },
      };
      const content = Buffer.from(JSON.stringify(originalData));

      const effect = Effect.gen(function* () {
        const storage = yield* Storage;

        // Upload
        yield* storage.upload(key, content, 'application/json');

        // Download
        const downloaded = yield* storage.download(key);

        return JSON.parse(downloaded.toString());
      }).pipe(Effect.provide(layer));

      const result = await Effect.runPromise(effect);

      expect(result).toEqual(originalData);
    });

    it('can overwrite existing file', async () => {
      const key = createTestKey('overwrite-test.txt');
      const content1 = Buffer.from('Original content');
      const content2 = Buffer.from('Updated content');

      const effect = Effect.gen(function* () {
        const storage = yield* Storage;

        // Upload original
        yield* storage.upload(key, content1, 'text/plain');

        // Overwrite
        yield* storage.upload(key, content2, 'text/plain');

        // Download and verify
        const downloaded = yield* storage.download(key);
        return downloaded.toString();
      }).pipe(Effect.provide(layer));

      const result = await Effect.runPromise(effect);
      expect(result).toBe('Updated content');
    });
  });
});

describe.skipIf(!hasS3Config)(
  'S3 Storage Live Integration - Error Handling',
  () => {
    describe('invalid credentials', () => {
      it('handles invalid credentials gracefully', async () => {
        const invalidLayer = S3StorageLive({
          bucket: S3_BUCKET!,
          region: S3_REGION!,
          accessKeyId: 'invalid-access-key',
          secretAccessKey: 'invalid-secret-key',
          endpoint: S3_ENDPOINT,
        });

        const effect = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.upload(
            'test-invalid-creds.txt',
            Buffer.from('test'),
            'text/plain',
          );
        }).pipe(Effect.provide(invalidLayer));

        const result = await Effect.runPromiseExit(effect);

        expect(result._tag).toBe('Failure');
        if (result._tag === 'Failure') {
          const error = result.cause;
          expect(error._tag).toBe('Fail');
          if (error._tag === 'Fail') {
            expect(error.error._tag).toBe('StorageUploadError');
          }
        }
      });
    });
  },
);
