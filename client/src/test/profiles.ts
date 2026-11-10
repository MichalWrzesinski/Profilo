import type { PublicProfile } from '@/lib/publicProfile';

export function publicProfile(content: Partial<PublicProfile['content']> = {}): PublicProfile {
  return {
    nick: 'anna-wisniewska',
    canonicalUrl: 'https://profilo.pl/user/anna-wisniewska',
    publishedAt: '2026-11-10T12:00:00Z',
    content: {
      displayName: 'Anna Wiśniewska',
      headline: 'Projektantka UX',
      bio: null,
      city: null,
      company: null,
      position: null,
      publicEmail: null,
      publicPhone: null,
      layout: 'classic',
      accent: 'morski',
      avatar: null,
      background: null,
      links: [],
      ...content,
    },
  };
}
