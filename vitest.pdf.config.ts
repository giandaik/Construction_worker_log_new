import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Config for the PDF layout tests only.
 *
 * The full suite boots a mongodb-memory-server per file; the sheet renderer has
 * no database in it, so this config skips globalSetup and runs in `node`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/pdf/**/*.test.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
