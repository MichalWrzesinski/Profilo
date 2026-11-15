import type { PublicProfile } from '@/lib/publicProfile';

/** The example page on the landing (mockup `public-split`), made-up data. */
export const SAMPLE_PROFILE: PublicProfile = {
  nick: 'anna-wisniewska',
  canonicalUrl: 'https://profilo.pl/user/anna-wisniewska',
  ogImageUrl: '',
  publishedAt: '2026-11-15T00:00:00Z',
  content: {
    displayName: 'Anna Wiśniewska',
    headline: 'Projektantka UX/UI i konsultantka produktowa',
    bio: 'Od 9 lat pomagam firmom projektować aplikacje, z których ludzie chętnie korzystają. Prowadzę badania z użytkownikami, warsztaty produktowe i projekty interfejsów — od pierwszego szkicu po gotowy design system.',
    city: 'Kraków',
    company: 'Studio Wiśniewska',
    position: 'Właścicielka',
    publicEmail: 'kontakt@example.com',
    publicPhone: '+48500000000', // fictional
    layout: 'split',
    accent: 'granat',
    avatar: null,
    background: null,
    links: [
      {
        id: '00000000-0000-7000-8000-000000000001',
        url: 'https://www.linkedin.com/',
        label: 'LinkedIn',
        service: 'linkedin',
      },
      {
        id: '00000000-0000-7000-8000-000000000002',
        url: 'https://www.behance.net/',
        label: 'Portfolio na Behance',
        service: 'behance',
      },
      {
        id: '00000000-0000-7000-8000-000000000003',
        url: 'https://example.com/',
        label: 'Strona studia',
        service: 'other',
      },
    ],
  },
};
