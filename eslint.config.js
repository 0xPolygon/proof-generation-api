import tseslint from 'typescript-eslint';
import pluginImportX from 'eslint-plugin-import-x';
import perfectionist from 'eslint-plugin-perfectionist';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

const internalPattern = '^@polygonlabs/';
export default tseslint.config(
  {
    ignores: ['**/dist', '**/generated/**', '**/docs/html/**/*']
  },
  tseslint.configs.base,
  tseslint.configs.eslintRecommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs'],
    plugins: {
      perfectionist
    },
    rules: {
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'natural',
          internalPattern: [internalPattern],
          groups: [
            'type-import',
            'value-builtin',
            'value-external',
            'type-internal',
            'value-internal',
            ['type-parent', 'type-sibling', 'type-index'],
            ['value-parent', 'value-sibling', 'value-index'],
            'ts-equals-import',
            'unknown'
          ]
        }
      ]
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ...pluginImportX.flatConfigs.recommended
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ...pluginImportX.flatConfigs.typescript
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.node
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    settings: {
      'import-x/resolver': {
        typescript: true
      },
      'import/internal-regex': internalPattern
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error'],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      'import-x/no-duplicates': ['error'],
      'import-x/no-extraneous-dependencies': ['off'],
      'import-x/no-relative-packages': ['error'],
      'import-x/no-unresolved': ['off'],
      'import-x/prefer-default-export': ['off'],
      'no-await-in-loop': 'off',
      'no-param-reassign': 'error',
      'no-underscore-dangle': ['off'],
      'no-useless-escape': 'off'
    }
  },
  prettierConfig
);
