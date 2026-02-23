import baseConfig, { restrictEnvAccess } from '@repo/eslint-config/base';

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ['dist/**'],
  },
  ...baseConfig,
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      'repo-custom/no-error-instanceof-in-backend-tests': 'off',
      'repo-custom/no-instanceof-in-effect-tests': 'off',
    },
  },
  ...restrictEnvAccess,
];
