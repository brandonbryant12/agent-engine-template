import { defineProject, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      name: '@repo/cli',
      include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    },
  }),
);
