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
