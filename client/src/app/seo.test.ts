import { json, mockFetch } from '@/test/fetch';
import robots from './robots';
import sitemap from './sitemap';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('robots.txt', () => {
  it('allows pages and preview cards, closes the API and points at the sitemap', () => {
    vi.stubEnv('PUBLIC_BASE_URL', 'https://profilo.pl/');

    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: ['/', '/api/v1/public/profiles/'], disallow: ['/api/'] },
      sitemap: 'https://profilo.pl/sitemap.xml',
    });
  });

  it('defaults to the local address', () => {
    vi.stubEnv('PUBLIC_BASE_URL', undefined);

    expect(robots().sitemap).toBe('http://localhost:8080/sitemap.xml');
  });
});

describe('sitemap.xml', () => {
  it('lists the public pages and every published profile', async () => {
    vi.stubEnv('PUBLIC_BASE_URL', 'https://profilo.pl');
    const fetch = mockFetch(() =>
      json(200, {
        items: [{ url: 'https://profilo.pl/user/anna', lastModified: '2026-11-10T12:00:00Z' }],
      }),
    );

    const entries = await sitemap();

    expect(entries).toEqual([
      { url: 'https://profilo.pl/' },
      { url: 'https://profilo.pl/regulamin' },
      { url: 'https://profilo.pl/prywatnosc' },
      { url: 'https://profilo.pl/user/anna', lastModified: '2026-11-10T12:00:00Z' },
    ]);
    expect(String(fetch.mock.calls[0]![0])).toMatch(/\/api\/v1\/public\/sitemap$/);
  });

  it('fails when the API fails, so a broken sitemap is never served as empty', async () => {
    mockFetch(() => json(503, { code: 'unavailable' }));

    await expect(sitemap()).rejects.toThrow('Sitemap request failed: 503');
  });
});
