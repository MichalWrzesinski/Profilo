import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open } from './helpers';

// Landing and legal pages (TASK-019): WCAG 2.1 AA and no sideways scrolling.
for (const path of ['/', '/regulamin', '/prywatnosc']) {
  for (const width of [320, 1440]) {
    test(`${path} is accessible and fits ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, path);
      if (path === '/') {
        // Scan the example page too, loaded (it is lazy) and inert.
        const frame = page.locator('iframe[title="Przykładowa strona w Profilo"]');
        await frame.scrollIntoViewIfNeeded();
        await expect(frame.contentFrame().locator('h1')).toHaveText('Anna Wiśniewska');
        await expect(frame).toHaveAttribute('inert', '');
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('nextjs-portal') // the dev overlay button
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }
}

test('legal pages name the operator and mark what is still to be supplied', async ({ page }) => {
  for (const path of ['/regulamin', '/prywatnosc']) {
    await open(page, path);
    await expect(page.getByText('Wersja demonstracyjna.')).toBeVisible();
    await expect(page.getByText(/Michał Wrzesiński Webhome/).first()).toBeVisible();
  }
  // The privacy policy still waits for the server location and processor confirmations.
  await expect(
    page.getByText('[do uzupełnienia: potwierdzenie lokalizacji serwera]'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Regulamin' }).last().click();
  await expect(page).toHaveURL(/\/regulamin$/);
});
