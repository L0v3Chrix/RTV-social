import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@rtv/domain': resolve(__dirname, 'packages/domain/dist/index.js'),
      '@rtv/types': resolve(__dirname, 'packages/types/dist/index.js'),
      '@rtv/db': resolve(__dirname, 'packages/db/dist/index.js'),
      '@rtv/db/schema': resolve(__dirname, 'packages/db/dist/schema/index.js'),
      '@rtv/core': resolve(__dirname, 'packages/core/dist/index.js'),
      '@rtv/utils': resolve(__dirname, 'packages/utils/dist/index.js'),
      '@rtv/observability': resolve(__dirname, 'packages/observability/dist/index.js'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/*.test.ts', 'packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
