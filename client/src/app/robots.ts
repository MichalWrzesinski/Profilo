import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

// PUBLIC_BASE_URL is read per request, so the same image serves every environment.
export const dynamic = 'force-dynamic';

/** Everything may be crawled; panel pages say `noindex` themselves (a robots.txt block would
 * hide that). The API is closed (its JSON would duplicate the pages) except the link-preview
 * cards, which X (Twitter) fetches only when robots.txt allows it. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/v1/public/profiles/*/og-image.jpg'],
      disallow: ['/api/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
