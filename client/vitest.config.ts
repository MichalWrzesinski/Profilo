import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Cache outside node_modules: checks may run as the host user (see Makefile AS_HOST).
  cacheDir: '/tmp/vite',
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts', './src/test/navigation.ts'],
    // node_modules is read-only for the host uid that runs checks (Makefile AS_HOST).
    fsModuleCachePath: '/tmp/vitest-cache',
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/app/layout.tsx',
        'src/test/**',
        'src/lib/api/schema.d.ts',
      ],
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
