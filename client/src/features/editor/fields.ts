import type { CountryCode } from 'libphonenumber-js';
import type { components } from '@/lib/api/schema';
import { phoneForSave, splitPhone } from '@/lib/phone';

export type OwnerProfile = components['schemas']['OwnerProfile'];

/** Editor form values: what the inputs show. */
export type Values = {
  displayName: string;
  headline: string;
  bio: string;
  position: string;
  company: string;
  city: string;
  publicEmail: string;
  phoneCountry: CountryCode;
  phoneNational: string;
};

/** Draft fields as the API names them (`PATCH /me/profile`). */
export type DraftKey =
  | 'displayName'
  | 'headline'
  | 'bio'
  | 'position'
  | 'company'
  | 'city'
  | 'publicEmail'
  | 'publicPhone';

export const DRAFT_KEYS: DraftKey[] = [
  'displayName',
  'headline',
  'bio',
  'position',
  'company',
  'city',
  'publicEmail',
  'publicPhone',
];

/** The draft field an input belongs to (both phone inputs make `publicPhone`). */
export function draftKeyOf(input: keyof Values): DraftKey {
  return input === 'phoneCountry' || input === 'phoneNational' ? 'publicPhone' : input;
}

export function valuesFrom(profile: OwnerProfile): Values {
  const { draft } = profile;
  const phone = splitPhone(draft.publicPhone ?? null);
  return {
    displayName: draft.displayName,
    headline: draft.headline ?? '',
    bio: draft.bio ?? '',
    position: draft.position ?? '',
    company: draft.company ?? '',
    city: draft.city ?? '',
    publicEmail: draft.publicEmail ?? '',
    phoneCountry: phone.country,
    phoneNational: phone.national,
  };
}

/** The value sent for a draft field; empty optional fields clear it (`null`). */
export function patchValue(values: Values, key: DraftKey): string | null {
  if (key === 'publicPhone') return phoneForSave(values.phoneCountry, values.phoneNational);
  const value = values[key].trim();
  return key === 'displayName' || value ? value : null;
}

export const LIMITS: Partial<Record<DraftKey, number>> = {
  displayName: 60,
  headline: 80,
  bio: 500,
  position: 60,
  company: 60,
  city: 60,
  publicEmail: 254,
};

/** Characters as the API counts them (code points, so an emoji is one). */
export function charCount(text: string): number {
  return [...text].length;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks done before saving (the API checks again, profile.md limits). */
export function validate(values: Values, key: DraftKey): string | null {
  const value = patchValue(values, key);
  if (key === 'displayName' && !value) return 'Wpisz nazwę.';
  const limit = LIMITS[key];
  if (limit && value && charCount(value) > limit) {
    return `Możesz wpisać najwyżej ${limit} znaków (teraz ${charCount(value)}).`;
  }
  if (key === 'publicEmail' && value && !EMAIL.test(value)) {
    return 'To nie wygląda na adres e-mail. Sprawdź, czy jest w nim @.';
  }
  return null;
}
