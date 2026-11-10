import { nickFormatError, normaliseNickInput } from './nick';

describe('normaliseNickInput (same cases as the API)', () => {
  it.each([
    ['Anna Wiśniewska', 'anna-wisniewska'],
    ['-anna', '-anna'],
    ['anna--maria', 'anna--maria'],
    ['Anna_W!', 'annaw'],
    ['  Łódź', 'lodz'],
    ['José Müller', 'jose-muller'],
  ])('%s → %s', (typed, expected) => {
    expect(normaliseNickInput(typed)).toBe(expected);
  });
});

describe('nickFormatError (PRF-BR-1)', () => {
  it.each([
    ['ab', 'too_short'],
    ['a'.repeat(41), 'too_long'],
    ['-anna', 'invalid_format'],
    ['anna-', 'invalid_format'],
    ['anna--wisniewska', 'invalid_format'],
    ['anna-wisniewska', null],
    ['a'.repeat(40), null],
  ])('%s → %s', (nick, error) => {
    expect(nickFormatError(nick)).toBe(error);
  });
});
