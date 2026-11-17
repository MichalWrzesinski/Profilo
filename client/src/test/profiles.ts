import type { PublicProfile } from '@/lib/publicProfile';

export function publicProfile(content: Partial<PublicProfile['content']> = {}): PublicProfile {
  return {
    nick: 'anna-wisniewska',
    canonicalUrl: 'https://profilo.pl/user/anna-wisniewska',
    ogImageUrl: 'https://profilo.pl/api/v1/public/profiles/anna-wisniewska/og-image.jpg?v=3',
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

type OwnerState = {
  status?: 'never_published' | 'published' | 'unpublished' | 'blocked';
  nick?: string | null;
  hasUnpublishedChanges?: boolean;
  publicUrl?: string | null;
  publishedAt?: string | null;
  draft?: Partial<PublicProfile['content']>;
};

/** The owner's profile as GET /me/profile returns it. */
export function ownerProfile({
  status = 'never_published',
  nick = 'anna-wisniewska',
  hasUnpublishedChanges = false,
  publicUrl = null,
  publishedAt = null,
  draft = {},
}: OwnerState = {}) {
  return {
    nick,
    nickLocked: status !== 'never_published',
    status,
    hasUnpublishedChanges,
    publishedAt,
    version: 4,
    draftUpdatedAt: '2026-11-10T10:00:00Z',
    publicUrl,
    draft: { ...publicProfile({ headline: null, accent: 'granat' }).content, ...draft },
  };
}
