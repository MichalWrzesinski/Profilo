import type { Metadata } from 'next';
import type { PublicProfile } from './publicProfile';

const DESCRIPTION_LENGTH = 160;

/** "{name} — {headline}", or the name alone (PUB-BR-7). */
export function pageTitle({ displayName, headline }: PublicProfile['content']): string {
  return headline ? `${displayName} — ${headline}` : displayName;
}

/** Text cut at a word boundary to at most `max` characters, with an ellipsis when cut. */
export function shorten(text: string, max = DESCRIPTION_LENGTH): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}

/** Meta description: the bio, or a sentence from the other details when there is none. */
export function pageDescription(content: PublicProfile['content']): string {
  if (content.bio?.trim()) return shorten(content.bio);
  const work = [content.position, content.company].filter(Boolean).join(', ');
  const details = [content.headline, work, content.city].filter(Boolean).join(' · ');
  return shorten(
    details
      ? `${content.displayName}: ${details}. Kontakt i linki w Profilo.`
      : `${content.displayName} — kontakt i linki w Profilo.`,
  );
}

/** Title, description, canonical URL, Open Graph and Twitter card of a public page. */
export function profileMetadata(profile: PublicProfile): Metadata {
  const title = pageTitle(profile.content);
  const description = pageDescription(profile.content);
  const image = {
    url: profile.ogImageUrl,
    width: 1200,
    height: 630,
    type: 'image/jpeg',
    alt: title,
  };
  return {
    title,
    description,
    alternates: { canonical: profile.canonicalUrl },
    openGraph: {
      type: 'profile',
      url: profile.canonicalUrl,
      siteName: 'Profilo',
      locale: 'pl_PL',
      title,
      description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/** schema.org ProfilePage with the person, as the page shows it (frontend standard). */
export function profileJsonLd(profile: PublicProfile): Record<string, unknown> {
  const { content, canonicalUrl } = profile;
  const absolute = (path: string) => new URL(path, canonicalUrl).toString();
  const person: Record<string, unknown> = {
    '@type': 'Person',
    name: content.displayName,
    url: canonicalUrl,
  };
  if (content.headline) person.description = content.headline;
  if (content.position) person.jobTitle = content.position;
  if (content.company) person.worksFor = { '@type': 'Organization', name: content.company };
  if (content.city) person.address = { '@type': 'PostalAddress', addressLocality: content.city };
  if (content.avatar?.urls['512']) person.image = absolute(content.avatar.urls['512']);
  if (content.links.length) person.sameAs = content.links.map((link) => link.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: canonicalUrl,
    dateModified: profile.publishedAt,
    mainEntity: person,
  };
}

/** JSON for an inline `<script type="application/ld+json">`: `<` escaped, so profile text
 * such as `</script>` cannot end the element. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
