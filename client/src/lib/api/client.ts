import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema';

export type Session = components['schemas']['Session'];
export type Account = components['schemas']['Account'];
export type FieldError = { field: string; code: string; message: string };
export type Problem = components['schemas']['Problem'] & { errors?: FieldError[] };

const CSRF_HEADERS = { 'X-Requested-With': 'profilo' } as const;

// Access token lives in memory only (security standard); the refresh token is an
// HttpOnly cookie that JavaScript cannot read.
let accessToken: string | null = null;

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string | null): void => {
    accessToken = token;
  },
};

function origin(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

export const api = createClient<paths>({
  baseUrl: origin(),
  // Resolve fetch at call time (tests replace it).
  fetch: (request) => globalThis.fetch(request),
});

let pendingRefresh: Promise<Session | null> | null = null;

/** Get a new access token from the refresh cookie; concurrent calls share one request. */
export function refreshSession(): Promise<Session | null> {
  pendingRefresh ??= (async () => {
    try {
      const { data } = await api.POST('/api/v1/auth/refresh', {
        // The browser sends the HttpOnly cookie itself; the contract lists it as a parameter.
        params: { header: CSRF_HEADERS, cookie: {} as { profilo_rt: string } },
      });
      tokenStore.set(data?.accessToken ?? null);
      return data ?? null;
    } catch {
      tokenStore.set(null);
      return null;
    } finally {
      pendingRefresh = null;
    }
  })();
  return pendingRefresh;
}

export async function logoutSession(): Promise<void> {
  try {
    await api.POST('/api/v1/auth/logout', {
      params: { header: CSRF_HEADERS, cookie: {} },
    });
  } finally {
    tokenStore.set(null);
  }
}

const AUTH_PATHS = ['/api/v1/auth/', '/api/v1/accounts'];

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = tokenStore.get();
    if (token && !AUTH_PATHS.some((path) => request.url.includes(path))) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
  async onResponse({ request, response }) {
    // Expired access token: refresh once and repeat safe requests.
    const retriable = request.method === 'GET' && !request.headers.has('X-Retried');
    if (response.status !== 401 || !retriable || AUTH_PATHS.some((p) => request.url.includes(p))) {
      return response;
    }
    const session = await refreshSession();
    if (!session) return response;
    const retry = new Request(request, { headers: new Headers(request.headers) });
    retry.headers.set('Authorization', `Bearer ${session.accessToken}`);
    retry.headers.set('X-Retried', '1');
    return globalThis.fetch(retry);
  },
};

api.use(authMiddleware);
