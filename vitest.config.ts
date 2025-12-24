import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Explicitly include tests to ensure tests/server is picked up
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/integration/**', 'node_modules/**', 'examples/**'],
  },
});
