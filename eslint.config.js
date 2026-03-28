import { defineConfig } from 'eslint/config';

import { recommended, typescript } from '@polygonlabs/apps-team-lint';

export default defineConfig([
  ...recommended({ globals: 'node' }),
  ...typescript(),
  { ignores: ['.claude/**', '**/generated/**', '**/docs/html/**/*', 'vitest.config.ts'] },
  // Allow underscore-prefixed function parameters to be intentionally unused.
  // Needed for Express error-handler signatures where the 4th `next` parameter
  // is required by Express for handler detection but never called.
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
]);
