import { scrubBreadcrumb, scrubEvent, scrubText } from './scrub';

const EMAIL = 'anna.kowalska@example.com';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXNpZ25hdHVyZQ';
const RELEASE = '0123456789abcdef0123456789abcdef01234567';

describe('scrubText', () => {
  it('removes e-mails, tokens, phone numbers and secrets in query strings', () => {
    const scrubbed = scrubText(
      `${EMAIL} ${JWT} /nowe-haslo?token=abc&x=1 +48 600 700 800 ${'a'.repeat(40)} 2026-11-16`,
    );
    expect(scrubbed).not.toContain(EMAIL);
    expect(scrubbed).not.toContain(JWT);
    expect(scrubbed).toContain('token=[Filtered]&x=1');
    expect(scrubbed).not.toContain('600 700 800');
    expect(scrubbed).not.toContain('a'.repeat(40));
    expect(scrubbed).toContain('2026-11-16');
  });
});

describe('scrubEvent', () => {
  it('drops user, request body, cookies and headers but keeps identifiers', () => {
    const event = scrubEvent({
      release: RELEASE,
      event_id: 'b'.repeat(32),
      user: { email: EMAIL },
      request: {
        url: `https://profilo.pl/nowe-haslo?token=${JWT}`,
        data: { password: 'secret' },
        cookies: { profilo_rt: JWT },
        env: { REMOTE_ADDR: '203.0.113.9' },
        headers: { 'User-Agent': 'Firefox', Authorization: `Bearer ${JWT}` },
      },
      extra: { password: 'tajne', items: [EMAIL], count: 2 },
      exception: { values: [{ type: 'TypeError', value: `failed for ${EMAIL}` }] },
    });
    expect(JSON.stringify(event)).not.toMatch(/kowalska|eyJ|tajne/);
    expect(event.release).toBe(RELEASE);
    expect(event.event_id).toBe('b'.repeat(32));
    expect(event).not.toHaveProperty('user');
    expect(event.request).toEqual({
      url: 'https://profilo.pl/nowe-haslo?token=[Filtered]',
      headers: { 'User-Agent': 'Firefox' },
    });
    expect(event.extra).toEqual({ password: '[Filtered]', items: ['[Filtered]'], count: 2 });
  });

  it('copes with a request without headers', () => {
    expect(scrubEvent({ request: { url: 'https://profilo.pl/' } }).request).toEqual({
      url: 'https://profilo.pl/',
      headers: {},
    });
    expect(scrubEvent({ message: 'x' })).toEqual({ message: 'x' });
  });
});

describe('scrubBreadcrumb', () => {
  it('scrubs messages and sensitive keys', () => {
    expect(scrubBreadcrumb({ message: `to ${EMAIL}`, data: { token: 'x', n: 1 } })).toEqual({
      message: 'to [Filtered]',
      data: { token: '[Filtered]', n: 1 },
    });
  });
});
