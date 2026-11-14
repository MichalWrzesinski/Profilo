import { expect, test, type Page } from '@playwright/test';
import { confirmationPath, open, TEST_PASSWORD } from './helpers';

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
  // Registration lands in the wizard.
  await open(page, '/rejestracja');
  await page.getByLabel('Imię i nazwisko lub pseudonim').fill(name);
  await page.getByLabel('E-mail do logowania').fill(email);
  await page.getByLabel('Hasło', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL(/\/kreator$/);

  // Step 1: the proposed nick is free.
  await expect(page.getByText(/Adres wolny/)).toBeVisible();
  const nick = await page.getByLabel('Adres Twojej strony').inputValue();
  expect(nick).toMatch(/^ewa-testowa-/);
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
  await expect(page).toHaveURL(/\/edytor$/);
  await expect(page.getByText('Strona jest opublikowana.')).toBeVisible();
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
});
