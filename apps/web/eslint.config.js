import { restrictEnvAccess } from '@repo/eslint-config/base';
import reactConfig from '@repo/eslint-config/react';

/** @type {import("eslint").Linter.Config} */
export default [
  ...reactConfig,
  ...restrictEnvAccess,
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      'repo-custom/no-error-instanceof-in-backend-tests': 'off',
      'repo-custom/no-instanceof-in-effect-tests': 'off',
    },
  },
  {
    files: ['vite.config.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
];
