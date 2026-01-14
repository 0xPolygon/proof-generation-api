module.exports = {
  extends: 'standard',
  rules: {
    'space-before-function-paren': ['error', 'never'],
    'no-underscore-dangle': 0,
    semi: ['error', 'never'],
  },
  overrides: [
    {
      files: ['*test.js'],
      rules: {
        'no-unused-expressions': 'off',
      },
    },
  ],
};
