import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'client'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'client', '**/*.test.ts', '**/*.spec.ts'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    // Set environment variables for tests (storage contract tests need this for import)
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    },
  },
});
