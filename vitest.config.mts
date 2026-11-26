import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    expect: { poll: { timeout: 10_000 } },
    snapshotFormat: {
      printBasicPrototype: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
    },
  },
});
