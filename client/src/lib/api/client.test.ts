import { json, mockFetch, requestAt, SESSION } from '@/test/fetch';
import {
  api,
  authorizedFetch,
  logoutSession,
  refreshSession,
  tokenStore,
  uploadWithProgress,
} from './client';

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

describe('authorizedFetch and uploadWithProgress', () => {
  it('sends the access token with a plain fetch', async () => {
    tokenStore.set('access-9', 900);
    const fetch = mockFetch(async () => new Response('x'));

    await authorizedFetch('http://localhost/media/a/128.webp');

    const init = fetch.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-9');
  });

  it('refreshes a missing token first and sends nothing when there is none', async () => {
    tokenStore.set(null);
    const fetch = mockFetch(async (request) =>
      request.url.endsWith('/auth/refresh') ? json(401, { status: 401 }) : new Response('x'),
    );

    await authorizedFetch('http://localhost/media/a/128.webp');

    const init = fetch.mock.calls.at(-1)![1] as RequestInit;
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('uploads with progress and returns the status and body', async () => {
    tokenStore.set('access-9', 900);
    const sent: { method?: string; url?: string; auth?: string | null } = {};
    class FakeXhr {
      upload: {
        onprogress:
          ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
      } = { onprogress: null };
      status = 200;
      responseText = '{"version":5}';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      open(method: string, url: string) {
        sent.method = method;
        sent.url = url;
      }
      setRequestHeader(name: string, value: string) {
        if (name === 'Authorization') sent.auth = value;
      }
      send() {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
        this.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
        this.onload?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const progress: number[] = [];

    const result = await uploadWithProgress(
      '/api/v1/me/profile/images/avatar',
      'PUT',
      new FormData(),
      (f) => progress.push(f),
    );

    expect(result).toEqual({ status: 200, body: { version: 5 } });
    expect(sent).toEqual({
      method: 'PUT',
      url: '/api/v1/me/profile/images/avatar',
      auth: 'Bearer access-9',
    });
    expect(progress).toEqual([0.5]);
  });

  it.each([
    ['', null],
    ['<html>', null],
  ])('reads a non-JSON body %j as null', async (text, body) => {
    tokenStore.set('access-9', 900);
    class FakeXhr {
      upload = { onprogress: null };
      status = 502;
      responseText = text;
      onload: (() => void) | null = null;
      open() {}
      setRequestHeader() {}
      send() {
        this.onload?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);

    expect(await uploadWithProgress('/x', 'PUT', new FormData(), () => {})).toEqual({
      status: 502,
      body,
    });
  });

  it('rejects when the network fails', async () => {
    tokenStore.set('access-9', 900);
    class FakeXhr {
      upload = { onprogress: null };
      onerror: (() => void) | null = null;
      open() {}
      setRequestHeader() {}
      send() {
        this.onerror?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);

    await expect(uploadWithProgress('/x', 'PUT', new FormData(), () => {})).rejects.toThrow();
  });
});
