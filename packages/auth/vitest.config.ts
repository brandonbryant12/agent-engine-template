import { defineProject, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.base.config';

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      name: '@repo/auth',
    },
  }),
);
