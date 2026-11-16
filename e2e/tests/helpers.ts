import { createHash } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';

export const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

/** Collects every Content-Security-Policy violation of the page (TASK-024), across
 * navigations and including workers: the documents' violation events ("directive
 * blocked-uri") and the browser's "Refused to …" console errors. Call before navigating. */
export async function recordViolations(page: Page): Promise<string[]> {
  const found: string[] = [];
  await page.exposeFunction('reportCspViolation', (violation: string) => {
    found.push(violation);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { reportCspViolation: (v: string) => void })
        .reportCspViolation;
      report(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
      found.push(message.text());
    }
  });
  return found;
}

/** Open a page and wait until React has taken it over (forms would submit natively before). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator('html[data-hydrated]').waitFor();
}

/** The confirmation link from the e-mail Mailpit received for `email`. */
export function confirmationPath(email: string): Promise<string> {
  return linkFromMail(`to:${email} subject:"Potwierdź adres"`, /\/potwierdz-email\?token=[\w-]+/);
}

/** The password reset link from the newest reset e-mail for `email`. */
export function resetPath(email: string): Promise<string> {
  return linkFromMail(`to:${email} subject:"Ustaw nowe hasło"`, /\/nowe-haslo\?token=[\w-]+/);
}

async function linkFromMail(query: string, pattern: RegExp): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(query)}`);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages.length) {
      const message = (await (
        await fetch(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)
      ).json()) as { Text: string };
      const match = pattern.exec(message.Text);
      if (match) return match[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No e-mail for ${query}`);
}

/** Password of the throwaway E2E accounts (local stack only, not a secret). */
export const TEST_PASSWORD = 'zielony-kubek-na-biurku-e2e'; // gitleaks:allow

type Challenge = {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
};

/** Solve a registration challenge (ALTCHA format) the way the browser's web worker does. */
export function solveChallenge(challenge: Challenge): string {
  for (let number = 0; number <= challenge.maxnumber; number += 1) {
    if (
      createHash('sha256').update(`${challenge.salt}${number}`).digest('hex') ===
      challenge.challenge
    ) {
      const { algorithm, salt, signature } = challenge;
      const payload = { algorithm, challenge: challenge.challenge, number, salt, signature };
      return Buffer.from(JSON.stringify(payload)).toString('base64');
    }
  }
  throw new Error('Unsolvable challenge');
}

/** POST /accounts, solving the proof-of-work challenge when the API asks for one. */
export async function registerAccount(request: APIRequestContext, data: Record<string, unknown>) {
  let response = await request.post('/api/v1/accounts', { data });
  if (response.status() === 428) {
    const { challenge } = (await response.json()) as { challenge: Challenge };
    response = await request.post('/api/v1/accounts', {
      data: { ...data, challenge: solveChallenge(challenge) },
    });
  }
  return response;
}

/** A confirmed owner created through the API, for tests that are not about sign-up. */
export async function owner(request: APIRequestContext, name: string, email: string) {
  const created = await registerAccount(request, {
    displayName: name,
    email,
    password: TEST_PASSWORD,
    acceptTerms: true,
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
