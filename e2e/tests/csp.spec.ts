import { expect, type Page, test } from '@playwright/test';
import { open } from './helpers';

// Content-Security-Policy with a per-request script nonce (TASK-024).

declare global {
  interface Window {
    cspViolations: string[];
    injected?: boolean;
  }
}

/** Records every CSP violation of the page (directive and what was blocked). */
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
}

test('pages work under the strict policy (scenario 1)', async ({ page }) => {
  await recordViolations(page);
  for (const path of [
    '/',
    '/przyklad',
    '/rejestracja',
    '/logowanie',
    '/nie-pamietam-hasla',
    '/regulamin',
  ]) {
    const response = await page.goto(path);
    await page.locator('html[data-hydrated]').waitFor(); // interactive: React took over
    const policy = response?.headers()['content-security-policy'] ?? '';
    expect(policy, path).toMatch(/script-src 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(policy, path).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(await page.evaluate(() => window.cspViolations), path).toEqual([]);
  }
});

test('every page request gets a new nonce', async ({ page }) => {
  const nonce = async () =>
    ((await page.goto('/'))?.headers()['content-security-policy'] ?? '').match(
      /'nonce-([^']+)'/,
    )?.[1];
  const first = await nonce();
  expect(first).toBeTruthy();
  expect(await nonce()).not.toBe(first);
});

test('an injected inline script without the nonce does not run (scenario 2)', async ({ page }) => {
  await recordViolations(page);
  await page.route('**/regulamin', async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      '</body>',
      '<script>window.injected = true</script></body>',
    );
    // The original headers (the CSP among them), minus those describing the old body.
    const headers = { ...response.headers() };
    delete headers['content-length'];
    delete headers['content-encoding'];
    await route.fulfill({ status: response.status(), headers, body: html });
  });
  // Waits for the load event, not hydration: the extra element itself makes React's
  // hydration of <body> mismatch (that is the injection, not the policy).
  await page.goto('/regulamin', { waitUntil: 'load' });

  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect
    .poll(() => page.evaluate(() => window.cspViolations))
    .toContainEqual(expect.stringMatching(/^script-src/));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
