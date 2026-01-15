module.exports = {
  extends: 'standard',
  rules: {
    'space-before-function-paren': ['off'],
    'no-underscore-dangle': ['off'],
    semi: ['error', 'always'],
    'comma-dangle': ['off'],
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
