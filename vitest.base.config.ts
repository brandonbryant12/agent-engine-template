import { defineConfig } from 'vitest/config';
import path from 'path';

const packagesRoot = path.resolve(__dirname, 'packages');

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', '**/*.test.ts', '**/__tests__/**'],
    },
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@repo/db/client': `${packagesRoot}/db/src/client.ts`,
      '@repo/db/schema': `${packagesRoot}/db/src/schema.ts`,
      '@repo/db/effect': `${packagesRoot}/db/src/effect.ts`,
      '@repo/db/errors': `${packagesRoot}/db/src/errors.ts`,
      '@repo/db/error-protocol': `${packagesRoot}/db/src/error-protocol.ts`,
      '@repo/db/runtime': `${packagesRoot}/db/src/runtime.ts`,
      '@repo/db/logging': `${packagesRoot}/db/src/logging.ts`,
      '@repo/db/telemetry': `${packagesRoot}/db/src/telemetry.ts`,
      '@repo/db': `${packagesRoot}/db/src/index.ts`,
      '@repo/storage/testing': `${packagesRoot}/storage/src/testing/index.ts`,
      '@repo/storage': `${packagesRoot}/storage/src/index.ts`,
      '@repo/queue': `${packagesRoot}/queue/src/index.ts`,
      '@repo/auth/policy': `${packagesRoot}/auth/src/policy/index.ts`,
      '@repo/auth/server': `${packagesRoot}/auth/src/server/index.ts`,
      '@repo/auth': `${packagesRoot}/auth/src/index.ts`,
      '@repo/auth-policy': `${packagesRoot}/auth-policy/src/index.ts`,
      '@repo/testing/factories': `${packagesRoot}/testing/src/factories/index.ts`,
      '@repo/testing/setup': `${packagesRoot}/testing/src/setup/index.ts`,
      '@repo/testing': `${packagesRoot}/testing/src/index.ts`,
      '@repo/ai/chat': `${packagesRoot}/ai/src/chat/index.ts`,
      '@repo/ai/testing': `${packagesRoot}/ai/src/testing/index.ts`,
      '@repo/ai/llm': `${packagesRoot}/ai/src/llm/index.ts`,
      '@repo/ai/tts': `${packagesRoot}/ai/src/tts/index.ts`,
      '@repo/ai': `${packagesRoot}/ai/src/index.ts`,
      '@repo/api/server': `${packagesRoot}/api/src/server/index.ts`,
      '@repo/api/contracts': `${packagesRoot}/api/src/contracts/index.ts`,
      '@repo/api/client': `${packagesRoot}/api/src/client/index.ts`,
    },
  },
});
