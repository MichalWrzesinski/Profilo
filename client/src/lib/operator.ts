/**
 * Operator details used by the legal pages, the footer and abuse reports. The user supplies
 * the real ones before production (docs/product/overview.md#constraints); until then every
 * value is a placeholder and is shown marked as such.
 */
export const OPERATOR = {
  name: null as string | null, // company or person running Profilo
  address: null as string | null,
  taxId: null as string | null, // NIP
  contactEmail: null as string | null,
  /** PUB-BR-10; a placeholder address until the operator gives the real one. */
  abuseEmail: 'naduzycia@profilo.pl',
  abuseEmailConfirmed: false,
};

/** Version of the legal drafts (changes are announced before they apply). */
export const LEGAL_VERSION = 'Wersja robocza z 15 listopada 2026 r.';
