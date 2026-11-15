import { publicProfile } from '@/test/profiles';
import {
  jsonLdScript,
  pageDescription,
  pageTitle,
  profileJsonLd,
  profileMetadata,
  shorten,
} from './seo';

describe('pageTitle', () => {
  it.each([
    ['Projektantka UX', 'Anna Wiśniewska — Projektantka UX'],
    [null, 'Anna Wiśniewska'],
  ])('joins the name and headline (%s)', (headline, title) => {
    expect(pageTitle(publicProfile({ headline }).content)).toBe(title);
  });
});

describe('shorten', () => {
  it('keeps short text and flattens white space', () => {
    expect(shorten('Projektuję\n\naplikacje.  ')).toBe('Projektuję aplikacje.');
  });

  it('cuts at a word boundary with an ellipsis', () => {
    const text = 'słowo '.repeat(40);

    const short = shorten(text, 30);

    expect(short).toBe('słowo słowo słowo słowo…');
    expect(short.length).toBeLessThanOrEqual(30);
  });

  it('cuts inside a very long word when there is no space to cut at', () => {
    expect(shorten('a'.repeat(50), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});

describe('pageDescription', () => {
  it('uses the bio', () => {
    expect(pageDescription(publicProfile({ bio: 'Projektuję aplikacje.' }).content)).toBe(
      'Projektuję aplikacje.',
    );
  });

  it('builds a sentence from the details without a bio', () => {
    const content = publicProfile({
      bio: '  ',
      position: 'Właścicielka',
      company: 'Studio',
      city: 'Gdańsk',
    }).content;

    expect(pageDescription(content)).toBe(
      'Anna Wiśniewska: Projektantka UX · Właścicielka, Studio · Gdańsk. Kontakt i linki w Profilo.',
    );
  });

  it('has a fallback for a page with only a name', () => {
    expect(pageDescription(publicProfile({ headline: null }).content)).toBe(
      'Anna Wiśniewska — kontakt i linki w Profilo.',
    );
  });
});

describe('profileMetadata', () => {
  it('has the canonical URL, Open Graph and a large Twitter card', () => {
    const metadata = profileMetadata(publicProfile({ bio: 'Projektuję aplikacje.' }));
    const image = expect.objectContaining({
      url: 'https://profilo.pl/api/v1/public/profiles/anna-wisniewska/og-image.jpg?v=3',
      width: 1200,
      height: 630,
    });

    expect(metadata).toMatchObject({
      title: 'Anna Wiśniewska — Projektantka UX',
      description: 'Projektuję aplikacje.',
      alternates: { canonical: 'https://profilo.pl/user/anna-wisniewska' },
      openGraph: {
        type: 'profile',
        url: 'https://profilo.pl/user/anna-wisniewska',
        locale: 'pl_PL',
        images: [image],
      },
      twitter: { card: 'summary_large_image', images: [image] },
    });
  });
});

describe('profileJsonLd', () => {
  it('describes the person with the details the page shows', () => {
    const profile = publicProfile({
      position: 'Właścicielka',
      company: 'Studio',
      city: 'Gdańsk',
      avatar: { id: 'a', urls: { '512': '/media/a/512.webp' } },
      links: [{ id: 'l', url: 'https://behance.net/anna', label: 'Behance', service: 'behance' }],
    });

    expect(profileJsonLd(profile)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: 'https://profilo.pl/user/anna-wisniewska',
      dateModified: '2026-11-10T12:00:00Z',
      mainEntity: {
        '@type': 'Person',
        name: 'Anna Wiśniewska',
        url: 'https://profilo.pl/user/anna-wisniewska',
        description: 'Projektantka UX',
        jobTitle: 'Właścicielka',
        worksFor: { '@type': 'Organization', name: 'Studio' },
        address: { '@type': 'PostalAddress', addressLocality: 'Gdańsk' },
        image: 'https://profilo.pl/media/a/512.webp',
        sameAs: ['https://behance.net/anna'],
      },
    });
  });

  it('leaves out what the page does not have', () => {
    expect(profileJsonLd(publicProfile({ headline: null })).mainEntity).toEqual({
      '@type': 'Person',
      name: 'Anna Wiśniewska',
      url: 'https://profilo.pl/user/anna-wisniewska',
    });
  });
});

describe('jsonLdScript', () => {
  it('escapes "<" so profile text cannot close the script element', () => {
    const script = jsonLdScript({ name: '</script><script>alert(1)</script>' });

    expect(script).not.toContain('<');
    expect(JSON.parse(script)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
