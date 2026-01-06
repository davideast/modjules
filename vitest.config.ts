import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Point to packages/core after monorepo migration
    include: [
      'packages/core/tests/**/*.test.ts',
      'packages/core/src/**/*.test.ts',
    ],
    exclude: [
      'packages/core/tests/integration/**',
      'node_modules/**',
      'examples/**',
    ],
  },
});
