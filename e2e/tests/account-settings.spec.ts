import { expect, test } from '@playwright/test';
import { MAILPIT, open, owner, TEST_PASSWORD } from './helpers';

const NEW_PASSWORD = 'zmienione-haslo-w-panelu-e2e'; // gitleaks:allow

test('the owner changes the password and then deletes the account', async ({ page, request }) => {
  const run = Date.now().toString(36);
  const email = `e2e-konto-${run}@example.pl`;
  const nick = `konto-${run}`;
  const other = await owner(request, 'Ula Ustawienia', email); // a session in another browser
  await other.call('PUT', '/api/v1/me/profile/nick', { nick });
  await other.publish({ headline: 'Do usunięcia' });
  expect((await request.get(`/user/${nick}`)).status()).toBe(200);

  // Log in and open the settings from the panel menu.
  await open(page, '/logowanie');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Hasło').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await page.getByRole('button', { name: 'Moje konto' }).click();
  await page.getByRole('link', { name: 'Ustawienia konta' }).click();
  await expect(page.getByRole('heading', { name: 'Ustawienia konta' })).toBeVisible();

  // Scenario 1: change the password; the other session ends, this one goes on.
  await page.getByLabel('Obecne hasło').fill(TEST_PASSWORD);
  await page.getByLabel('Nowe hasło').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Zmień hasło' }).click();
  await expect(page.getByText(/Hasło zmienione/)).toBeVisible();
  expect((await request.get('/api/v1/me', { headers: other.headers })).status()).toBe(401);

  // Scenario 3 on deletion: a wrong password deletes nothing.
  await page.getByRole('button', { name: 'Usuń konto' }).click();
  const dialog = page.getByRole('dialog', { name: 'Usunąć konto na zawsze?' });
  await expect(dialog).toContainText(`/user/${nick} przestanie działać od razu`);
  await dialog.getByLabel('Wpisz hasło, aby potwierdzić').fill(TEST_PASSWORD);
  await dialog.getByRole('button', { name: 'Usuń konto' }).click();
  await expect(dialog.getByText('Hasło jest nieprawidłowe')).toBeVisible();
  expect((await request.get(`/user/${nick}`)).status()).toBe(200);

  // Scenario 2: delete with the current password.
  await dialog.getByLabel('Wpisz hasło, aby potwierdzić').fill(NEW_PASSWORD);
  await dialog.getByRole('button', { name: 'Usuń konto' }).click();
  await expect(page).toHaveURL(/\/konto-usuniete$/);
  await expect(page.getByRole('heading', { name: 'Konto usunięte' })).toBeVisible();
  expect((await request.get(`/user/${nick}`)).status()).toBe(404);
  const login = await request.post('/api/v1/auth/login', {
    data: { email, password: NEW_PASSWORD },
  });
  expect(login.status()).toBe(401);

  // The nick is in quarantine: a new owner cannot take it.
  const stranger = await owner(request, 'Obcy', `e2e-obcy-${run}@example.pl`);
  const taken = await request.put('/api/v1/me/profile/nick', {
    headers: stranger.headers,
    data: { nick },
  });
  expect(taken.status()).toBe(409);

  // The confirmation e-mail arrived.
  await expect
    .poll(async () => {
      const query = encodeURIComponent(`to:${email} subject:"zostało usunięte"`);
      const search = await fetch(`${MAILPIT}/api/v1/search?query=${query}`);
      return ((await search.json()) as { messages: unknown[] }).messages.length;
    })
    .toBe(1);
});
