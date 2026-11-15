import { expect, test } from '@playwright/test';
import { open, TEST_PASSWORD } from './helpers';

test('many registrations from one network must solve a challenge first', async ({
  page,
  request,
}) => {
  const run = Date.now().toString(36);
  const email = `e2e-bot-${run}@example.pl`;
  const data = { displayName: 'Bot', email, password: TEST_PASSWORD, acceptTerms: true };

  // Attempts from this address until the API asks for proof of work (at once in a full run).
  let status = 0;
  for (let attempt = 0; attempt < 4 && status !== 428; attempt += 1) {
    status = (await request.post('/api/v1/accounts', { data })).status();
  }
  expect(status).toBe(428);
  const forged = await request.post('/api/v1/accounts', {
    data: { ...data, email: `inny-${email}`, challenge: Buffer.from('{}').toString('base64') },
  });
  expect(forged.status()).toBe(428);

  // A real visitor on the same network: the browser solves it in a web worker and goes on.
  await open(page, '/rejestracja');
  await page.getByLabel('Imię i nazwisko lub pseudonim').fill('Ola Prawdziwa');
  await page.getByLabel('E-mail do logowania').fill(`e2e-czlowiek-${run}@example.pl`);
  await page.getByLabel('Hasło', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('checkbox').check();
  const answer = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/accounts') && response.status() === 201,
  );
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await answer;
  await expect(page).toHaveURL(/\/kreator$/);
});
