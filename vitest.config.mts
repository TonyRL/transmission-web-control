import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    environment: 'node',
    snapshotFormat: {
      printBasicPrototype: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
    },
  },
});
