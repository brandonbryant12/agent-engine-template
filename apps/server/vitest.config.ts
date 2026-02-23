import { defineProject, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.base.config';

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      name: 'server',
      include: ['src/__tests__/**/*.test.ts'],
      // Integration tests need more time
      testTimeout: 60000,
    },
  }),
);
