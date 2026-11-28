import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    environment: 'node',
    exclude: [...configDefaults.exclude, 'e2e/setup.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    expect: { poll: { timeout: 10_000 } },
    snapshotFormat: {
      printBasicPrototype: true,
    },
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'dev', include: ['e2e/**/*.test.ts'], provide: { preview: false } },
      },
      {
        extends: true,
        test: { name: 'preview', include: ['e2e/**/*.test.ts'], provide: { preview: true } },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['cobertura', 'text-summary'],
    },
  },
});
