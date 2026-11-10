import {
  draftKeyOf,
  patchValue,
  validate,
  valuesFrom,
  type OwnerProfile,
  type Values,
} from './fields';

const base: Values = {
  displayName: 'Anna',
  headline: '',
  bio: '',
  position: '',
  company: '',
  city: '',
  publicEmail: '',
  phoneCountry: 'PL',
  phoneNational: '',
};

describe('editor fields', () => {
  it('maps both phone inputs to publicPhone', () => {
    expect(draftKeyOf('phoneCountry')).toBe('publicPhone');
    expect(draftKeyOf('phoneNational')).toBe('publicPhone');
    expect(draftKeyOf('bio')).toBe('bio');
  });

  it('sends trimmed values and clears empty optional fields', () => {
    const values = { ...base, headline: '  UX  ', city: '   ', phoneNational: '601 234 567' };

    expect(patchValue(values, 'headline')).toBe('UX');
    expect(patchValue(values, 'city')).toBeNull();
    expect(patchValue(values, 'publicPhone')).toBe('+48 601 234 567');
    expect(patchValue({ ...base, displayName: ' ' }, 'displayName')).toBe('');
  });

  it.each([
    [{ displayName: '' }, 'displayName', 'Wpisz nazwę.'],
    [{ bio: 'x'.repeat(501) }, 'bio', 'Możesz wpisać najwyżej 500 znaków (teraz 501).'],
    [{ headline: 'x'.repeat(81) }, 'headline', 'Możesz wpisać najwyżej 80 znaków (teraz 81).'],
    [
      { publicEmail: 'anna@' },
      'publicEmail',
      'To nie wygląda na adres e-mail. Sprawdź, czy jest w nim @.',
    ],
    [{ bio: 'x'.repeat(500) }, 'bio', null],
    [{ publicEmail: '' }, 'publicEmail', null],
  ] as const)('validates %o', (change, key, message) => {
    expect(validate({ ...base, ...change }, key)).toBe(message);
  });

  it('reads empty draft fields as empty inputs', () => {
    const profile = {
      draft: {
        displayName: 'Anna',
        headline: null,
        bio: null,
        city: null,
        company: null,
        position: null,
        publicEmail: null,
        publicPhone: '+48601234567',
      },
    } as OwnerProfile;

    expect(valuesFrom(profile)).toEqual({
      ...base,
      phoneNational: '601 234 567',
    });
  });
});
