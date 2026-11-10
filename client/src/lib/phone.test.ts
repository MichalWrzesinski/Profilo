import { formatPhone, phoneForSave, splitPhone } from './phone';

describe('phone helpers (PRF-BR-12)', () => {
  it.each([
    ['+48601234567', '+48 601 234 567'],
    ['+4930901820', '+49 30 901820'],
    ['nie-numer', 'nie-numer'],
  ])('formats %s as %s', (e164, shown) => {
    expect(formatPhone(e164)).toBe(shown);
  });

  it.each([
    ['+48601234567', { country: 'PL', national: '601 234 567' }],
    ['+4930901820', { country: 'DE', national: '030 901820' }],
    ['+81312345678', { country: 'PL', national: '+81312345678' }],
    [null, { country: 'PL', national: '' }],
  ])('splits %s for the editor', (e164, parts) => {
    expect(splitPhone(e164)).toEqual(parts);
  });

  it.each([
    ['PL', '601 234 567', '+48 601 234 567'],
    ['DE', '030 901820', '+49 030 901820'],
    ['PL', '+44 20 7946 0958', '+44 20 7946 0958'],
    ['PL', '0048601234567', '0048601234567'],
    ['PL', '   ', null],
    ['PL', '48601234567', '+48601234567'],
    ['PL', '48 601 234 567', '+48601234567'],
    ['PL', '486012345', '+48 486012345'],
  ] as const)('prepares %s %s for saving', (country, national, value) => {
    expect(phoneForSave(country, national)).toBe(value);
  });
});
