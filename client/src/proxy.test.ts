import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

afterEach(() => vi.unstubAllEnvs());

function nonceOf(policy: string | null) {
  return policy?.match(/'nonce-([^']+)'/)?.[1];
}

describe('proxy', () => {
  it('gives every page request its own nonce, in the request and the response', () => {
    const first = proxy(new NextRequest('https://profilo.pl/user/anna'));
    const second = proxy(new NextRequest('https://profilo.pl/user/anna'));
    const policy = first.headers.get('Content-Security-Policy');
    expect(nonceOf(policy)).toBeTruthy();
    expect(nonceOf(policy)).not.toBe(nonceOf(second.headers.get('Content-Security-Policy')));
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('unsafe-eval');
  });

  it('lets the preview be framed and allows eval in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const policy = proxy(new NextRequest('https://profilo.pl/podglad')).headers.get(
      'Content-Security-Policy',
    );
    expect(policy).toContain("frame-ancestors 'self'");
    expect(policy).toContain("'unsafe-eval'");
  });

  it('runs for pages only', () => {
    const source = new RegExp(`^${config.matcher[0]}$`);
    for (const page of [
      '/',
      '/panel',
      '/user/anna-nowak',
      '/nowe-haslo',
      '/podglad',
      '/user/a.b',
    ]) {
      expect(source.test(page)).toBe(true);
    }
    for (const file of [
      '/api/v1/me',
      '/media/a/b.webp',
      '/_next/static/chunks/a.js',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/icon-192.png',
      '/logo.svg',
    ]) {
      expect(source.test(file)).toBe(false);
    }
  });
});
