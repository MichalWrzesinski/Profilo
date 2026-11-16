/**
 * Operator details used by the legal pages, the footer and abuse reports (supplied by the
 * user on 2026-11-16). A null value is shown as a marked placeholder.
 */
export const OPERATOR = {
  name: 'Michał Wrzesiński Webhome' as string | null, // company or person running Profilo
  address: 'Karasiowa 7, 85-435 Bydgoszcz' as string | null,
  taxId: '9671286620' as string | null, // NIP
  // Also for complaints, appeals and the DSA point of contact (terms §5–§7).
  contactEmail: 'profilo@gitpush.app' as string | null,
};

/** Shown while ABUSE_EMAIL is not configured: a non-deliverable address (RFC 2606), so
 * reports with personal data never reach whoever owns a look-alike domain. */
export const PLACEHOLDER_ABUSE_EMAIL = 'naduzycia@profilo.invalid';

// One plain address: nothing that could add mailto headers (`?`, `&`, `#`) or spaces.
const EMAIL = /^[^@\s?#&]+@[^@\s?#&]+\.[^@\s?#&]+$/;

/**
 * Operator address for abuse reports (PUB-BR-10) from the ABUSE_EMAIL setting, read on the
 * server at request time; null while it is not configured.
 */
export function configuredAbuseEmail(): string | null {
  const value = process.env.ABUSE_EMAIL?.trim();
  return value && EMAIL.test(value) ? value : null;
}

/** The address for the „Zgłoś nadużycie” link: the configured one or the placeholder. */
export function abuseEmail(): string {
  return configuredAbuseEmail() ?? PLACEHOLDER_ABUSE_EMAIL;
}

/** Version of the legal drafts (changes are announced before they apply). */
export const LEGAL_VERSION = 'Wersja robocza z 15 listopada 2026 r.';
