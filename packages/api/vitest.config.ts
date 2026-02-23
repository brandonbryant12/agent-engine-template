import { defineProject, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.base.config';

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      name: '@repo/api',
      // Include test files in subdirectories
      include: ['src/**/*.test.ts'],
      // Use existing test database at localhost:5433 (started via docker compose)
      // Tests use transaction rollback for isolation
      env: {
        TEST_POSTGRES_URL:
          'postgresql://test:test@localhost:5433/agent_engine_template_test',
      },
      // Increase timeout for database operations
      testTimeout: 30000,
      hookTimeout: 60000,
    },
  }),
);
