import { Globe } from 'lucide-react';
import type { components } from '@/lib/api/schema';

type Service = components['schemas']['LinkService'];

/** Short marks of known services, as in the design system (no brand logos). */
export const MARKS: Record<Exclude<Service, 'other'>, string> = {
  linkedin: 'in',
  github: 'GH',
  x: 'X',
  instagram: 'IG',
  facebook: 'f',
  youtube: 'YT',
  behance: 'Bē',
  dribbble: 'Dr',
  tiktok: 'TT',
};

/** The service mark alone (Card layout icon links). */
export function LinkMark({ service }: { service: Service }) {
  return service === 'other' ? <Globe className="i" aria-hidden="true" /> : <>{MARKS[service]}</>;
}

export function LinkIcon({ service }: { service: Service }) {
  return (
    <span className="link-ico" aria-hidden="true">
      <LinkMark service={service} />
    </span>
  );
}

// Second-level labels under country domains: „sklep.com.pl” is Sklep, not SklepCom.
const SECOND_LEVEL = new Set([
  'com.pl',
  'org.pl',
  'net.pl',
  'gov.pl',
  'edu.pl',
  'biz.pl',
  'info.pl',
  'co.uk',
  'org.uk',
  'net.uk',
  'gov.uk',
  'ac.uk',
]);

/**
 * A name for a link to a service without a mark, from its address in PascalCase: the
 * subdomains (except `www`) and the domain, without the top-level domain —
 * `https://webhome.pl` → „Webhome”, `https://blog.webhome.pl` → „BlogWebhome”.
 */
export function domainName(url: string): string {
  // The host as stored (not URL.hostname, which turns „żabka.pl” into punycode).
  const match = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^/:?#]+)/i.exec(url.trim());
  if (!match) return shortUrl(url);
  const host = match[1]!.toLowerCase().replace(/\.$/, '');
  const labels = host.split('.').filter(Boolean);
  // Keep the backend's ASCII display for non-Latin hosts to avoid look-alike domains.
  if (labels.some((label) => label.startsWith('xn--'))) return shortUrl(url);
  if (labels[0] === 'www') labels.shift();
  const suffix = labels.slice(-2).join('.');
  if (labels.length > 1) labels.pop(); // top-level domain
  if (labels.length > 1 && SECOND_LEVEL.has(suffix)) labels.pop();
  return labels
    .flatMap((label) => label.split('-'))
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

/** „linkedin.com/in/anna” for display: no scheme, no `www.`, no trailing slash. */
export function shortUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}
