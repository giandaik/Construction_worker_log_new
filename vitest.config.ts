import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // Whole-suite runs take an exclusive lock: ~20 files spin up their own
    // mongodb-memory-server, and two concurrent `vitest run` processes collide
    // on those ports. See test/globalSetup.ts.
    globalSetup: ['./test/globalSetup.ts'],
    // Within one run, ~20 files each boot their own mongod; running them
    // concurrently makes them race for ports and fail intermittently. 50s
    // serial vs 35s parallel is a good trade for a suite that means something.
    fileParallelism: false,
    globals: true,
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
}); 