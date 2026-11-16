import { expect, type Page, test } from '@playwright/test';
import { open, owner, TEST_PASSWORD } from './helpers';

// The private pages fit a 320 px phone: no sideways scrolling.

/** Elements whose right edge goes past the viewport (for the failure message). */
function offenders(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => el.getBoundingClientRect().right > width + 0.5)
      .slice(0, 8)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
        return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} right=${Math.round(rect.right)} width=${Math.round(rect.width)}`;
      });
  });
}

test('the editor, panel and account pages fit 320 px', async ({ page, request }) => {
  const run = Date.now().toString(36);
  const email = `e2e-narrow-${run}@example.pl`;
  const ewa = await owner(request, 'Ewa Wąska-Długonazwiskowa', email);
  await ewa.call('PUT', '/api/v1/me/profile/nick', { nick: `waska-${run}` });
  await ewa.publish({ headline: 'Projektantka wnętrz i doradczyni kolorystyczna' });

  await page.setViewportSize({ width: 320, height: 800 });
  await open(page, '/logowanie');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Hasło').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).not.toHaveURL(/logowanie/);

  const fits = async (what: string) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${what}: ${(await offenders(page)).join(', ')}`).toBe(0);
  };
  for (const path of ['/panel', '/edytor', '/panel/konto']) {
    await open(page, path);
    await page.waitForLoadState('networkidle');
    await fits(path);
  }

  // The editor's preview tab on a phone.
  await open(page, '/edytor');
  await page.getByRole('tab', { name: 'Podgląd' }).click();
  await expect(
    page.frameLocator('iframe[title="Podgląd wersji roboczej"]').locator('h1'),
  ).toHaveText('Ewa Wąska-Długonazwiskowa');
  await fits('/edytor (preview tab)');
});
