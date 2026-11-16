import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('a first visit shows the cookie and data notice once', async ({ page }) => {
  await page.goto('/');
  const notice = page.getByRole('dialog', { name: 'Pliki cookie i Twoje dane' });
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Rozumiem' }).click();
  await expect(notice).toBeHidden();

  await page.goto('/logowanie');
  await page.locator('html[data-hydrated]').waitFor();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
