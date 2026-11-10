import { json, mockFetch, requestAt, SESSION } from '@/test/fetch';
import { api, logoutSession, refreshSession, tokenStore } from './client';

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
});

describe('refreshSession', () => {
  it('stores the new access token and sends the CSRF header', async () => {
    const fetch = mockFetch(() => json(200, SESSION));

    const session = await refreshSession();

    expect(session?.account.email).toBe('anna@example.pl');
    expect(tokenStore.get()).toBe('access-1');
    expect(requestAt(fetch, 0).headers.get('X-Requested-With')).toBe('profilo');
    expect(requestAt(fetch, 0).url).toMatch(/\/api\/v1\/auth\/refresh$/);
  });

  it('shares one request between concurrent callers', async () => {
    const fetch = mockFetch(() => json(200, SESSION));

    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('clears the token when the session cannot be refreshed', async () => {
    tokenStore.set('old');
    mockFetch(() => json(401, { code: 'unauthorized', status: 401 }));

    expect(await refreshSession()).toBeNull();
    expect(tokenStore.get()).toBeNull();
  });

  it('clears the token when the network fails', async () => {
    tokenStore.set('old');
    mockFetch(() => Promise.reject(new TypeError('offline')));

    expect(await refreshSession()).toBeNull();
    expect(tokenStore.get()).toBeNull();
  });
});

describe('authenticated requests', () => {
  it('adds the access token to API calls but not to auth endpoints', async () => {
    tokenStore.set('access-1');
    const fetch = mockFetch((request) =>
      request.url.endsWith('/me') ? json(200, SESSION.account) : json(200, SESSION),
    );

    await api.GET('/api/v1/me');
    await api.POST('/api/v1/auth/login', { body: { email: 'a@b.pl', password: 'x' } });

    expect(requestAt(fetch, 0).headers.get('Authorization')).toBe('Bearer access-1');
    expect(requestAt(fetch, 1).headers.get('Authorization')).toBeNull();
  });

  it('sends the access token to authenticated /auth endpoints such as resend', async () => {
    tokenStore.set('access-1');
    const fetch = mockFetch(() => new Response(null, { status: 202 }));

    await api.POST('/api/v1/auth/email-confirmations');

    expect(requestAt(fetch, 0).headers.get('Authorization')).toBe('Bearer access-1');
  });

  it('refreshes once and repeats a GET after 401', async () => {
    tokenStore.set('expired');
    const fetch = mockFetch((request) => {
      if (request.url.endsWith('/auth/refresh')) return json(200, SESSION);
      return request.headers.get('Authorization') === 'Bearer access-1'
        ? json(200, SESSION.account)
        : json(401, { code: 'unauthorized', status: 401 });
    });

    const { data } = await api.GET('/api/v1/me');

    expect(data?.email).toBe('anna@example.pl');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('refreshes ahead of expiry before any request, including mutations', async () => {
    tokenStore.set('almost-expired', 30); // less than a minute left
    const fetch = mockFetch((request) =>
      request.url.endsWith('/auth/refresh') ? json(200, SESSION) : json(200, SESSION.account),
    );

    await api.GET('/api/v1/me');

    expect(requestAt(fetch, 0).url).toMatch(/\/auth\/refresh$/);
    expect(requestAt(fetch, 1).headers.get('Authorization')).toBe('Bearer access-1');
    expect(tokenStore.expiresSoon()).toBe(false);
  });

  it('returns the 401 when the refresh fails', async () => {
    tokenStore.set('expired');
    mockFetch(() => json(401, { code: 'unauthorized', status: 401 }));

    const { response } = await api.GET('/api/v1/me');

    expect(response.status).toBe(401);
  });
});

describe('logoutSession', () => {
  it('calls logout and forgets the token even if the request fails', async () => {
    tokenStore.set('access-1');
    const fetch = mockFetch(() => Promise.reject(new TypeError('offline')));

    await expect(logoutSession()).rejects.toThrow();

    expect(requestAt(fetch, 0).url).toMatch(/\/api\/v1\/auth\/logout$/);
    expect(tokenStore.get()).toBeNull();
  });
});
