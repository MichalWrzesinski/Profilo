import { expect, test } from '@playwright/test';
import { owner, recordViolations } from './helpers';

/** Same path on the stack under test (the tags carry PUBLIC_BASE_URL, not http://caddy). */
const local = (url: string) => {
  const parsed = new URL(url);
  return parsed.pathname + parsed.search;
};

test('a published page has link-preview tags and is in the sitemap until unpublished', async ({
  page,
  request,
}) => {
  const run = Date.now().toString(36);
  const ewa = await owner(request, 'Ewa Podgląd', `e2e-seo-${run}@example.pl`);
  const { nick } = await ewa.call('PUT', '/api/v1/me/profile/nick', { nick: `seo-${run}` });
  await ewa.publish({ headline: 'Fotografka ślubna', bio: 'Zdjęcia z wesel w całej Polsce.' });

  // Scenario 1: title, description and an og:image that returns 200.
  const found = await recordViolations(page); // public page: JSON-LD, Sentry (TASK-024)
  await page.goto(`/user/${nick}`);
  await page.locator('html[data-hydrated]').waitFor();
  expect(found).toEqual([]);
  await expect(page).toHaveTitle('Ewa Podgląd — Fotografka ślubna');
  const meta = (selector: string) => page.locator(selector).getAttribute('content');
  expect(await meta('meta[name="description"]')).toBe('Zdjęcia z wesel w całej Polsce.');
  expect(await meta('meta[property="og:title"]')).toBe('Ewa Podgląd — Fotografka ślubna');
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonical).toMatch(new RegExp(`/user/${nick}$`));
  const ogImage = local((await meta('meta[property="og:image"]'))!);
  const card = await request.get(ogImage);
  expect(card.status()).toBe(200);
  expect(card.headers()['content-type']).toBe('image/jpeg');
  expect((await request.get('/robots.txt')).ok()).toBe(true);
  expect(await (await request.get('/sitemap.xml')).text()).toContain(`/user/${nick}</loc>`);

  // Scenario 3: unpublished pages leave the sitemap and return 404, the card too.
  await ewa.call('POST', '/api/v1/me/profile/unpublish');
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain(`/user/${nick}</loc>`);
  expect((await request.get(`/user/${nick}`)).status()).toBe(404);
  expect((await request.get(ogImage)).status()).toBe(404);
});

test('panel pages are kept out of search results', async ({ request }) => {
  for (const path of ['/panel', '/edytor', '/kreator', '/opublikowano']) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain('<meta name="robots" content="noindex, nofollow"/>');
  }
});
