import { expect, test } from '@playwright/test';
import { open, owner, resetPath, TEST_PASSWORD } from './helpers';

const NEW_PASSWORD = 'nowe-haslo-po-resecie-e2e'; // gitleaks:allow

test('a forgotten password is reset from the e-mail link and other sessions end', async ({
  page,
  request,
}) => {
  const run = Date.now().toString(36);
  const email = `e2e-reset-${run}@example.pl`;
  const other = await owner(request, 'Iza Reset', email); // a session in another browser

  // „Nie pamiętam hasła” from the login page.
  await open(page, '/logowanie');
  await page.getByRole('link', { name: 'Nie pamiętam hasła' }).click();
  await expect(page).toHaveURL(/\/nie-pamietam-hasla$/);
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('E-mail do logowania').fill(email);
  await page.getByRole('button', { name: 'Wyślij link' }).click();
  await expect(page.getByText(/Jeśli konto z adresem .* istnieje/)).toBeVisible();

  // The link from Mailpit: new password, logged in.
  const link = await resetPath(email);
  await open(page, link);
  await page.getByLabel('Nowe hasło').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Ustaw nowe hasło' }).click();
  await expect(page.getByText('Hasło zmienione.')).toBeVisible();
  await page.getByRole('link', { name: 'Przejdź do panelu' }).click();
  await expect(page.getByRole('heading', { name: 'Twoja strona' })).toBeVisible();

  // The other session is over, the old password too; the link works only once.
  expect((await request.get('/api/v1/me', { headers: other.headers })).status()).toBe(401);
  const oldLogin = await request.post('/api/v1/auth/login', {
    data: { email, password: TEST_PASSWORD },
  });
  expect(oldLogin.status()).toBe(401);
  await open(page, link);
  await page.getByLabel('Nowe hasło').fill('jeszcze-inne-haslo-e2e');
  await page.getByRole('button', { name: 'Ustaw nowe hasło' }).click();
  await expect(page.getByText('Link wygasł.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Wyślij nowy link' })).toHaveAttribute(
    'href',
    '/nie-pamietam-hasla',
  );
});

test('an unknown address gets the same answer', async ({ page }) => {
  await open(page, '/nie-pamietam-hasla');
  await page.getByLabel('E-mail do logowania').fill(`nikt-${Date.now()}@example.pl`);
  await page.getByRole('button', { name: 'Wyślij link' }).click();

  await expect(page.getByText(/Jeśli konto z adresem .* istnieje/)).toBeVisible();
});
