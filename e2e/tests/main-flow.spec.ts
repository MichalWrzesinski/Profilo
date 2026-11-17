import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import {
  confirmationPath,
  expectNoSidewaysScroll,
  open,
  recordViolations,
  TEST_PASSWORD,
} from './helpers';

// Main flow (docs/design/flows.md): register → nick → content → preview → confirm e-mail
// (Mailpit) → publish → public page; the preview must match the public page.

const run = Date.now().toString(36);
const email = `e2e-${run}@example.pl`;
const name = `Ewa Testowa ${run}`;

/**
 * The rendered public page component. `style` is compared without spaces and a trailing
 * semicolon: the server and
 * the browser serialise the same inline style differently. No images are used in this flow.
 */
async function pageHtml(page: Page | ReturnType<Page['frameLocator']>) {
  const html = await page.locator('.pp').evaluate((element) => element.outerHTML);
  return html.replace(
    /style="([^"]*)"/g,
    (_, style: string) => `style="${style.replace(/\s+/g, '').replace(/;$/, '')}"`,
  );
}

test('a new owner publishes a page that looks exactly like the preview', async ({ page }) => {
  const found = await recordViolations(page); // editor, preview iframe, postMessage (TASK-024)
  // The landing: „Zarezerwuj adres” opens registration with the chosen address (TASK-019).
  await open(page, '/');
  await expect(
    page.frameLocator('iframe[title="Przykładowa strona w Profilo"]').locator('h1'),
  ).toHaveText('Anna Wiśniewska');
  await page.getByRole('textbox', { name: 'Wybrany adres strony' }).fill(`Ewa Testowa ${run}`);
  await page.getByRole('button', { name: 'Zarezerwuj adres' }).click();
  // The field shows the address as it will be, so the form sends it normalised.
  await expect(page).toHaveURL(new RegExp(`/rejestracja\\?adres=ewa-testowa-${run}$`));
  await page.locator('html[data-hydrated]').waitFor();

  // Registration lands in the wizard.
  await page.getByLabel('Imię i nazwisko lub pseudonim').fill(name);
  await page.getByLabel('E-mail do logowania').fill(email);
  await page.getByLabel('Hasło', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL(new RegExp(`/kreator\\?adres=ewa-testowa-${run}$`));

  // Step 1: the address from the landing, checked and free.
  await expect(page.getByText(/Adres wolny/)).toBeVisible();
  const nick = await page.getByLabel('Adres Twojej strony').inputValue();
  expect(nick).toBe(`ewa-testowa-${run}`);
  await page.getByRole('button', { name: 'Dalej →' }).click();

  // Step 2: layout and colour.
  await expect(page).toHaveURL(/\/kreator\/wyglad$/);
  await page.getByRole('radio', { name: /Dzielony/ }).click();
  await page.getByRole('radio', { name: 'Morski' }).click();
  await page.getByRole('button', { name: 'Dalej: treść →' }).click();
  await expect(page).toHaveURL(/\/kreator\/tresc$/);
  await expect(page.getByLabel('Krok 3 z 4: Treść')).toBeVisible();

  // Step 3: content; the preview follows the form within a second.
  const preview = page.frameLocator('iframe[title="Podgląd wersji roboczej"]');
  await page.getByLabel('Nagłówek').fill('Projektantka usług publicznych');
  await expect(preview.locator('.headline')).toHaveText('Projektantka usług publicznych', {
    timeout: 1000,
  });
  await page.getByLabel('Miejscowość').fill('Toruń');
  await page.getByLabel('Publiczny e-mail').fill(`kontakt-${run}@example.pl`);
  await page.getByRole('button', { name: 'Dodaj pierwszy link' }).click();
  await page.getByLabel('Adres strony').fill('linkedin.com/in/ewa-testowa');
  await page.getByRole('button', { name: 'Zapisz link' }).click();
  await expect(page.getByText('linkedin.com/in/ewa-testowa')).toBeVisible();
  await expect(page.locator('.save-state')).toHaveText('Zapisano');
  await page.getByRole('button', { name: 'Dalej: podgląd →' }).click();

  // Step 4 before confirming the e-mail: publishing is disabled with a hint.
  await expect(page).toHaveURL(/\/kreator\/podglad$/);
  const publish = page.getByRole('button', { name: 'Opublikuj stronę' });
  await expect(publish).toBeDisabled();
  await expect(page.getByText('Najpierw potwierdź e-mail')).toBeVisible();

  // Confirm with the link from the e-mail, then publish.
  await open(page, await confirmationPath(email));
  await expect(page.getByText(/potwierdzony/i)).toBeVisible();
  await open(page, '/kreator/podglad');
  const stepPreview = page.frameLocator('iframe[title="Podgląd strony"]');
  await expect(stepPreview.locator('h1')).toHaveText(name);
  await expect(publish).toBeEnabled();
  await publish.click();

  // „Opublikowano”: the address, the copy action and the QR code (TASK-014).
  await expect(page).toHaveURL(/\/opublikowano$/);
  await expect(
    page.getByRole('heading', { name: 'Gotowe! Twoja strona jest online' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Adres strony' })).toHaveValue(
    new RegExp(`/user/${nick}$`),
  );
  await expect(page.getByRole('img', { name: /^Kod QR z adresem/ })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Pobierz PNG' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`profilo-${nick}.png`);
  const qr = PNG.sync.read(readFileSync((await download.path())!));
  expect([qr.width, qr.height]).toEqual([1024, 1024]);
  // Quiet zone: 40 px in from every edge is light (4 modules are wider up to version 13).
  for (let i = 0; i < 1024; i += 8) {
    for (const [x, y] of [
      [i, 40],
      [40, i],
      [i, 1000],
      [1000, i],
    ] as const) {
      expect(qr.data[(y * 1024 + x) * 4]).toBe(255);
    }
  }
  await page.getByRole('link', { name: 'Przejdź do edytora' }).click();
  await expect(page).toHaveURL(/\/edytor$/);
  const editorPreview = page.frameLocator('iframe[title="Podgląd wersji roboczej"]');
  await expect(editorPreview.locator('h1')).toHaveText(name);
  const previewHtml = await pageHtml(editorPreview);

  // The public page is the preview, element for element.
  await page.goto(`/user/${nick}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.locator('.pp')).toHaveClass(/pp-split/);
  await expect(page.getByText('Projektantka usług publicznych')).toBeVisible();
  await expect(page.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute(
    'href',
    'https://linkedin.com/in/ewa-testowa',
  );
  expect(await pageHtml(page)).toBe(previewHtml);

  // One owner exercises shared navigation without increasing the registration budget.
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of [
      '/',
      '/panel',
      '/edytor',
      '/panel/konto',
      '/regulamin',
      '/prywatnosc',
      '/logowanie',
      '/nie-pamietam-hasla',
      '/nowe-haslo',
      '/potwierdz-email',
      '/rejestracja',
      '/opublikowano',
      '/kreator',
      '/kreator/wyglad',
      '/kreator/tresc',
      '/kreator/podglad',
      '/nie-istnieje',
    ]) {
      await open(page, path);
      await expect(page.getByRole('button', { name: 'Moje konto', exact: true })).toBeVisible();
      const header = page.locator('header.topbar');
      await expect(header).toHaveCount(1);
      await expect(header.getByRole('link', { name: /Zobacz swój profil/ })).toBeVisible();
      if (path === '/edytor') {
        await expect(header).not.toContainText('Zalogowano jako');
        await expect(header.getByRole('button', { name: /Opublikuj/ })).toBeVisible();
        await expect(header.getByRole('button', { name: /Udostępnij/ })).toBeVisible();
      } else if (width > 860) await expect(header).toContainText(`Zalogowano jako ${email}`);
      if (width === 320)
        expect(await header.evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBe(
          56,
        );
      const footer = page.getByRole('contentinfo');
      await expect(footer).toHaveCount(1);
      await expect(footer.getByRole('link', { name: 'Regulamin', exact: true })).toBeVisible();
      await expect(
        footer.getByRole('link', { name: 'Polityka prywatności', exact: true }),
      ).toBeVisible();
      await expectNoSidewaysScroll(page, `${path} at ${width}`);
    }
  }
  await open(page, '/edytor');
  await page.getByRole('tab', { name: 'Podgląd' }).click();
  await expect(
    page.frameLocator('iframe[title="Podgląd wersji roboczej"]').locator('h1'),
  ).toHaveText(name);
  await expectNoSidewaysScroll(page, '/edytor (preview tab)');

  expect(found).toEqual([]); // the whole flow ran under the page CSP (TASK-024)
});
