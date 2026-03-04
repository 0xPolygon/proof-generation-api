import { recommended, javascript, typescript } from '@polygonlabs/apps-team-lint';

export default [
  ...recommended(),
  ...javascript({ globals: 'node' }),
  ...typescript({ globals: 'node', tsconfigRootDir: import.meta.dirname }),
  { ignores: ['.claude/**', '**/generated/**', '**/docs/html/**/*', 'vitest.config.ts'] }
];
