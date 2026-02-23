import { defineProject, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.base.config';

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      name: 'worker',
      include: ['src/__tests__/**/*.test.ts'],
      testTimeout: 60000,
    },
  }),
);
