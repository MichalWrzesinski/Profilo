import type { MetadataRoute } from 'next';
import type { components } from '@/lib/api/schema';
import { apiBase } from '@/lib/publicProfile';
import { siteUrl } from '@/lib/site';

// Built on every request: an unpublished page must leave the sitemap at once.
export const dynamic = 'force-dynamic';

type Sitemap = components['schemas']['Sitemap'];

/** Home, legal pages and every visible published profile (PUB-BR-7). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const response = await fetch(`${apiBase()}/api/v1/public/sitemap`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Sitemap request failed: ${response.status}`);
  const { items } = (await response.json()) as Sitemap;
  const site = siteUrl();
  return [
    { url: `${site}/` },
    { url: `${site}/regulamin` },
    { url: `${site}/prywatnosc` },
    ...items.map(({ url, lastModified }) => ({ url, lastModified })),
  ];
}
