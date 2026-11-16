import { expect, test } from '@playwright/test';
import { open, recordViolations } from './helpers';

// Content-Security-Policy with a per-request script nonce (TASK-024).

declare global {
  interface Window {
    injected?: boolean;
  }
}

test('pages work under the strict policy (scenario 1)', async ({ page }) => {
  const found = await recordViolations(page);
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
    expect(found, path).toEqual([]);
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
  const found = await recordViolations(page);
  let served = '';
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
    served = html;
    await route.fulfill({ status: response.status(), headers, body: html });
  });
  // Waits for the load event, not hydration: the extra element itself makes React's
  // hydration of <body> mismatch (that is the injection, not the policy).
  await page.goto('/regulamin', { waitUntil: 'load' });

  // The script was in the HTML (React later removes the unexpected element), did not run,
  // and the policy blocked exactly an inline script.
  expect(served).toContain('<script>window.injected = true</script>');
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect.poll(() => found).toContainEqual(expect.stringMatching(/^script-src\S* inline$/));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('a 404 for a dotted path is still interactive', async ({ page }) => {
  const found = await recordViolations(page);
  const response = await page.goto('/user/anna.nowak');
  expect(response?.status()).toBe(404);
  await page.locator('html[data-hydrated]').waitFor();
  expect(found).toEqual([]);
});
