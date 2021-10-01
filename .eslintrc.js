module.exports = {
  extends: 'standard',
  rules: {
    'space-before-function-paren': ['error', 'never'],
    'no-underscore-dangle': 0
  },
  "overrides": [
    {
        "files": ["*test.js"],
        "rules": {
            "no-unused-expressions": "off"
        }
    }
  ]
}
