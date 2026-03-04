import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    setupFiles: ['@dotenvx/dotenvx/config'],
    fileParallelism: true,
    server: {
      deps: {
        inline: ['@maticnetwork/maticjs', '@maticnetwork/maticjs-ethers']
      }
    }
  }
});
