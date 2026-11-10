/**
 * Nick rules (PRF-BR-1, PRF-BR-3) — the same rules as api/app/modules/profiles/nicks.py,
 * checked by identical test cases on both sides.
 */
export const NICK_RULE =
  '3–40 znaków: małe litery, cyfry i pojedyncze myślniki, bez myślnika na początku i końcu.';
const PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const POLISH: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  Ą: 'A',
  Ć: 'C',
  Ę: 'E',
  Ł: 'L',
  Ń: 'N',
  Ó: 'O',
  Ś: 'S',
  Ź: 'Z',
  Ż: 'Z',
};

function asciiLower(text: string): string {
  return text
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => POLISH[ch]!)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * What the owner types: as PRF-BR-2 (separators → hyphen, other characters dropped), but typed
 * hyphens stay as they are so the owner sees the rule. Only leading whitespace is trimmed: a
 * trailing space becomes the hyphen before the next word.
 */
export function normaliseNickInput(text: string): string {
  return asciiLower(text.trimStart())
    .replace(/[\s_./\\,;:+&|]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export type NickFormatError = 'too_short' | 'too_long' | 'invalid_format';

export function nickFormatError(nick: string): NickFormatError | null {
  if (nick.length < 3) return 'too_short';
  if (nick.length > 40) return 'too_long';
  if (!PATTERN.test(nick)) return 'invalid_format';
  return null;
}
