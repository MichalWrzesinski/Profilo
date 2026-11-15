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
};

/** Shown while ABUSE_EMAIL is not configured (local stack, tests). */
export const PLACEHOLDER_ABUSE_EMAIL = 'naduzycia@profilo.pl';

/**
 * Operator address for abuse reports (PUB-BR-10) from the ABUSE_EMAIL setting, read on the
 * server at request time; null while it is not configured.
 */
export function configuredAbuseEmail(): string | null {
  const value = process.env.ABUSE_EMAIL?.trim();
  return value ? value : null;
}

/** The address for the „Zgłoś nadużycie” link: the configured one or the placeholder. */
export function abuseEmail(): string {
  return configuredAbuseEmail() ?? PLACEHOLDER_ABUSE_EMAIL;
}

/** Version of the legal drafts (changes are announced before they apply). */
export const LEGAL_VERSION = 'Wersja robocza z 15 listopada 2026 r.';
