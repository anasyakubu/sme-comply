// Backend tests run in Node; higher hook timeouts allow database test setup.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 120000,
    setupFiles: ['./tests/setupEnv.ts'],
    fileParallelism: false,
  },
});
