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
let expiresAt = 0;

/** Refresh this long before the access token expires (any request method then works). */
const REFRESH_AHEAD_MS = 60_000;

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string | null, expiresInSeconds = 900): void => {
    accessToken = token;
    expiresAt = token ? Date.now() + expiresInSeconds * 1000 : 0;
  },
  expiresSoon: (): boolean => accessToken !== null && expiresAt - Date.now() < REFRESH_AHEAD_MS,
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
      tokenStore.set(data?.accessToken ?? null, data?.expiresIn);
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

// Endpoints authenticated by the refresh cookie or by credentials, never by the access
// token. Exact paths: other /auth/* endpoints (e.g. resend confirmation) need the token.
const TOKEN_ENDPOINTS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/accounts',
]);

function isTokenEndpoint(request: Request): boolean {
  return TOKEN_ENDPOINTS.has(new URL(request.url).pathname);
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (isTokenEndpoint(request)) return request;
    if (tokenStore.expiresSoon()) await refreshSession();
    const token = tokenStore.get();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
  async onResponse({ request, response }) {
    // Token rejected anyway (e.g. clock skew): refresh once and repeat safe requests.
    const retriable = request.method === 'GET' && !request.headers.has('X-Retried');
    if (response.status !== 401 || !retriable || isTokenEndpoint(request)) {
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

/** A fresh access token (refreshed first when it is about to expire), or null. */
export async function freshAccessToken(): Promise<string | null> {
  if (tokenStore.expiresSoon() || !tokenStore.get()) await refreshSession();
  return tokenStore.get();
}

/** `fetch` with the access token, for responses that are not JSON (e.g. draft images). */
export async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await freshAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return globalThis.fetch(url, { ...init, headers });
}

export type UploadResult = { status: number; body: unknown };

/**
 * Upload a file with progress (fetch cannot report upload progress). Resolves with the
 * status and parsed JSON body; rejects only when the network fails.
 */
export async function uploadWithProgress(
  url: string,
  method: 'PUT' | 'POST',
  form: FormData,
  onProgress: (fraction: number) => void,
): Promise<UploadResult> {
  const token = await freshAccessToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(form);
  });
}
