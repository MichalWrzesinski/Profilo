import type { PublicProfile } from '@/lib/publicProfile';

/**
 * The example page on the landing (mockup `public-split`), made-up data. The demo server has the
 * same page live at /user/anna-wisniewska; the landing links to it.
 */
export const SAMPLE_PROFILE: PublicProfile = {
  nick: 'anna-wisniewska',
  canonicalUrl: 'https://profilo.pl/user/anna-wisniewska',
  ogImageUrl: '',
  publishedAt: '2026-11-15T00:00:00Z',
  content: {
    displayName: 'Anna Wiśniewska',
    headline: 'Projektantka UX/UI i konsultantka produktowa',
    bio: 'Od 9 lat pomagam firmom projektować aplikacje, z których ludzie chętnie korzystają. Prowadzę badania z użytkownikami, warsztaty produktowe i projekty interfejsów — od pierwszego szkicu po gotowy design system.',
    city: 'Bydgoszcz',
    company: 'Studio Wiśniewska',
    position: 'Właścicielka',
    publicEmail: 'kontakt@example.com',
    publicPhone: '+48500000000', // fictional
    layout: 'split',
    accent: 'granat',
    // Static files in public/przyklad (an AI-generated portrait supplied by the owner).
    avatar: {
      id: '00000000-0000-7000-8000-0000000000a1',
      urls: { '256': '/przyklad/anna-256.jpg', '512': '/przyklad/anna-512.jpg' },
    },
    background: null,
    // The same links as the live page on the demo server.
    links: [
      {
        id: '00000000-0000-7000-8000-000000000001',
        url: 'https://linkedin.com',
        label: 'LinkedIn',
        service: 'linkedin',
      },
      {
        id: '00000000-0000-7000-8000-000000000002',
        url: 'https://github.com',
        label: 'GitHub',
        service: 'github',
      },
      {
        id: '00000000-0000-7000-8000-000000000003',
        url: 'https://x.com',
        label: 'X',
        service: 'x',
      },
    ],
  },
};
