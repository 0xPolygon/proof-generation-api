import globals from 'globals';

import rootConfig from '../../eslint.config.js';

export default [
  ...rootConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.mocha
      }
    }
  }
];
