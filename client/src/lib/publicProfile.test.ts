import { json, mockFetch } from '@/test/fetch';
import { publicProfile } from '@/test/profiles';
import { getPublicProfile, initials } from './publicProfile';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('initials', () => {
  it.each([
    ['Anna Wiśniewska', 'AW'],
    ['łukasz  żółć ', 'ŁŻ'],
    ['Jan Maria Rokita', 'JR'],
    ['Kasia', 'K'],
    ['   ', ''],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('getPublicProfile', () => {
  it('reads the snapshot from the internal API without caching', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api:8000');
    const fetch = mockFetch(async () => json(200, publicProfile()));

    const profile = await getPublicProfile('anna wiśniewska');

    const [url, init] = fetch.mock.calls[0]!;
    expect(profile?.nick).toBe('anna-wisniewska');
    expect(String(url)).toBe('http://api:8000/api/v1/public/profiles/anna%20wi%C5%9Bniewska');
    expect(init).toMatchObject({ cache: 'no-store' });
  });

  it('returns null for a hidden page', async () => {
    mockFetch(async () => json(404, { status: 404, code: 'not_found' }));

    expect(await getPublicProfile('nie-ma')).toBeNull();
  });

  it('fails loudly when the API fails', async () => {
    mockFetch(async () => json(500, { status: 500 }));

    await expect(getPublicProfile('anna')).rejects.toThrow('500');
  });
});
