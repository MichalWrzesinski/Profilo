import type { APIRequestContext, Page } from '@playwright/test';

export const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

/** Open a page and wait until React has taken it over (forms would submit natively before). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator('html[data-hydrated]').waitFor();
}

/** The confirmation link from the e-mail Mailpit received for `email`. */
export async function confirmationPath(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages.length) {
      const message = (await (
        await fetch(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)
      ).json()) as { Text: string };
      const match = /\/potwierdz-email\?token=[\w-]+/.exec(message.Text);
      if (match) return match[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No confirmation e-mail for ${email}`);
}

/** Password of the throwaway E2E accounts (local stack only, not a secret). */
export const TEST_PASSWORD = 'zielony-kubek-na-biurku-e2e'; // gitleaks:allow

/** A confirmed owner created through the API, for tests that are not about sign-up. */
export async function owner(request: APIRequestContext, name: string, email: string) {
  const created = await request.post('/api/v1/accounts', {
    data: { displayName: name, email, password: TEST_PASSWORD, acceptTerms: true },
  });
  if (!created.ok()) throw new Error(`Registration failed: ${created.status()}`);
  const { accessToken } = (await created.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };
  const token = new URL(await confirmationPath(email), 'http://x').searchParams.get('token');
  await request.post('/api/v1/auth/email-confirmations/confirm', { data: { token } });

  const call = async (method: 'GET' | 'PUT' | 'PATCH' | 'POST', path: string, data?: unknown) => {
    const response = await request.fetch(path, { method, headers, data });
    if (!response.ok()) throw new Error(`${method} ${path}: ${response.status()}`);
    return response.json() as Promise<{ version: number; nick: string }>;
  };
  return {
    headers,
    call,
    /** Change the draft (version handled) and publish it. */
    async publish(patch: Record<string, unknown>) {
      const { version } = await call('GET', '/api/v1/me/profile');
      const saved = await call('PATCH', '/api/v1/me/profile', { version, ...patch });
      await call('POST', '/api/v1/me/profile/publish', { version: saved.version });
    },
  };
}
