import path from 'node:path';
import type { NextConfig } from 'next';

const repoRoot = path.join(import.meta.dirname, '..');

const nextConfig: NextConfig = {
  output: 'standalone',
  // The app imports design tokens from docs/design (single source of truth).
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
  poweredByHeader: false,
  // Dev server only: the E2E browser reaches the app through Caddy as http://caddy.
  allowedDevOrigins: ['caddy'],
  reactStrictMode: true,
};

export default nextConfig;
