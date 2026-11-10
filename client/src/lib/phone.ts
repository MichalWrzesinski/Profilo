import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/** Countries in the editor's phone prefix list; Poland first and the default (PRF-BR-12). */
export const PHONE_COUNTRIES: { code: CountryCode; dial: string; label: string }[] = [
  { code: 'PL', dial: '+48', label: '🇵🇱 +48' },
  { code: 'DE', dial: '+49', label: '🇩🇪 +49' },
  { code: 'GB', dial: '+44', label: '🇬🇧 +44' },
  { code: 'IE', dial: '+353', label: '🇮🇪 +353' },
  { code: 'NL', dial: '+31', label: '🇳🇱 +31' },
  { code: 'CZ', dial: '+420', label: '🇨🇿 +420' },
  { code: 'SK', dial: '+421', label: '🇸🇰 +421' },
  { code: 'UA', dial: '+380', label: '🇺🇦 +380' },
  { code: 'US', dial: '+1', label: '🇺🇸 +1' },
];

/** „+48 601 234 567” for a stored E.164 number; the raw value when it cannot be parsed. */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

/** Stored E.164 → the editor's country and national number („601 234 567”). */
export function splitPhone(e164: string | null): { country: CountryCode; national: string } {
  const number = e164 ? parsePhoneNumberFromString(e164) : undefined;
  const known = PHONE_COUNTRIES.find((c) => c.code === number?.country);
  if (!number || !known) return { country: 'PL', national: e164 ?? '' };
  return { country: known.code, national: number.formatNational() };
}

/** What the editor sends: the number with the chosen prefix, unless it already has one. */
export function phoneForSave(country: CountryCode, national: string): string | null {
  const typed = national.trim();
  if (!typed) return null;
  if (typed.startsWith('+') || typed.startsWith('00')) return typed;
  const dial = PHONE_COUNTRIES.find((c) => c.code === country)?.dial ?? '+48';
  // „48601234567” typed with +48 chosen: the prefix is already there, without the „+”.
  const digits = typed.replace(/[\s().-]/g, '');
  const withPlus = parsePhoneNumberFromString(`+${digits}`);
  if (
    /^\d+$/.test(digits) &&
    digits.startsWith(dial.slice(1)) &&
    withPlus?.country === country &&
    withPlus.isValid() &&
    !parsePhoneNumberFromString(`${dial}${digits}`)?.isValid()
  ) {
    return `+${digits}`;
  }
  return `${dial} ${typed}`;
}
