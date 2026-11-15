import type { Metadata } from 'next';

/**
 * Public address of the site, e.g. `https://profilo.pl` (PUBLIC_BASE_URL, read on the server
 * at request time, so one image serves every environment). Used by robots.txt and sitemap.xml.
 */
export function siteUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
}

/** Pages behind login: never in search results, links not followed (PUB-BR-7). */
export const PRIVATE_PAGE: Metadata = { robots: { index: false, follow: false } };
