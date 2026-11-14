import { Globe } from 'lucide-react';
import type { components } from '@/lib/api/schema';

type Service = components['schemas']['LinkService'];

/** Short marks of known services, as in the design system (no brand logos). */
const MARKS: Record<Exclude<Service, 'other'>, string> = {
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

export function LinkIcon({ service }: { service: Service }) {
  return (
    <span className="link-ico" aria-hidden="true">
      {service === 'other' ? <Globe className="i" /> : MARKS[service]}
    </span>
  );
}

/** „linkedin.com/in/anna” for display: no scheme, no `www.`, no trailing slash. */
export function shortUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}
