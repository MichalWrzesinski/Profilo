import { defineConfig, devices } from '@playwright/test';

// Runs in the `e2e` Compose service against the local stack (Caddy, Mailpit).
const baseURL = process.env.BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  use: {
    baseURL,
    // The cookie and data notice is already closed; privacy-notice.spec.ts starts without it.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [{ name: 'profilo:privacy-notice', value: '1' }],
        },
      ],
    },
    locale: 'pl-PL',
    navigationTimeout: 60_000, // the dev server compiles a route on its first request
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
});
