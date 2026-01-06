// vitest.integration.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/core/tests/integration/**/*.test.ts'],
    exclude: ['node_modules/**'],
  },
});
