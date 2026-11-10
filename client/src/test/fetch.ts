import { vi } from 'vitest';

export type Handler = (request: Request) => Response | Promise<Response>;

export function json(
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
): Response {
  const type = status >= 400 ? 'application/problem+json' : 'application/json';
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': type, ...headers },
  });
}

/** Replace global fetch; returns the mock so tests can inspect requests. */
export function mockFetch(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(input instanceof Request ? input : new Request(input, init)),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function requestAt(fn: ReturnType<typeof mockFetch>, index: number): Request {
  return fn.mock.calls[index]![0] as Request;
}

export const SESSION = {
  accessToken: 'access-1',
  expiresIn: 900,
  account: {
    id: '0199a1b2-0000-7000-8000-000000000001',
    email: 'anna@example.pl',
    emailConfirmed: false,
    createdAt: '2026-11-10T10:00:00Z',
  },
};
