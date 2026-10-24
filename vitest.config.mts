import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirror the "@/*" path mapping in tsconfig.json so tests can import the
    // same way the app does. import.meta.url rather than __dirname: this file
    // is ESM, and Vite warns when it has to load it as CommonJS.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
