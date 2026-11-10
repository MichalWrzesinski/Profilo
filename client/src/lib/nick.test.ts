import cases from '../../../docs/api/nick-cases.json';
import { type NickFormatError, nickFormatError, normaliseNickInput } from './nick';

// Shared with api/tests/test_nicks.py so both sides apply the same rules.
describe('normaliseNickInput (shared cases)', () => {
  it.each(cases.input as [string, string][])('%s → %s', (typed, expected) => {
    expect(normaliseNickInput(typed)).toBe(expected);
  });
});

describe('nickFormatError (PRF-BR-1, shared cases)', () => {
  it.each(cases.format as [string, NickFormatError | null][])('%s → %s', (nick, error) => {
    expect(nickFormatError(nick)).toBe(error);
  });
});
