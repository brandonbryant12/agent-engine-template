import { defineProject, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.base.config';

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      name: '@repo/testing',
      // Enable testcontainers global setup when running integration tests
      // Usage: pnpm test --project @repo/testing --globalSetup ./src/vitest-global-setup.ts
      // globalSetup: ['./src/vitest-global-setup.ts'],
    },
  }),
);
