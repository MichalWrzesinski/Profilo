import { abuseEmail, configuredAbuseEmail, PLACEHOLDER_ABUSE_EMAIL } from './operator';

afterEach(() => vi.unstubAllEnvs());

it('uses ABUSE_EMAIL when it is set', () => {
  vi.stubEnv('ABUSE_EMAIL', ' zgloszenia@operator.pl ');

  expect(configuredAbuseEmail()).toBe('zgloszenia@operator.pl');
  expect(abuseEmail()).toBe('zgloszenia@operator.pl');
});

it('falls back to the placeholder', () => {
  vi.stubEnv('ABUSE_EMAIL', '');

  expect(configuredAbuseEmail()).toBeNull();
  expect(abuseEmail()).toBe(PLACEHOLDER_ABUSE_EMAIL);
});

it.each(['a@b.pl?bcc=x@y.pl', 'nie-adres', 'a b@c.pl'])('ignores an odd value %j', (value) => {
  vi.stubEnv('ABUSE_EMAIL', value);

  expect(configuredAbuseEmail()).toBeNull();
});
