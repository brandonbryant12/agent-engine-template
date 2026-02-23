import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'agent-engine/scripts/vitest.config.ts',
      'packages/db/vitest.config.ts',
      'packages/storage/vitest.config.ts',
      'packages/queue/vitest.config.ts',
      'packages/auth/vitest.config.ts',
      'packages/testing/vitest.config.ts',
      'packages/api/vitest.config.ts',
      'apps/server/vitest.config.ts',
      'apps/worker/vitest.config.ts',
      'apps/web/vitest.config.ts',
    ],
  },
});
