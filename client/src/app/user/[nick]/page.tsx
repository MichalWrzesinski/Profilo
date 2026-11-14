import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { PublicPage as Page } from '@/features/public/PublicPage';
import { getPublicProfile } from '@/lib/publicProfile';

type Props = { params: Promise<{ nick: string }> };

// Rendered on every request: hiding a page must take effect at once (PRF-BR-17).
export const dynamic = 'force-dynamic';

async function nickOf(params: Props['params']): Promise<string | null> {
  try {
    return decodeURIComponent((await params).nick);
  } catch {
    return null; // malformed escape such as %E0
  }
}

async function load(params: Props['params']) {
  const nick = await nickOf(params);
  return nick ? { nick, profile: await getPublicProfile(nick) } : { nick, profile: null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { profile } = await load(params);
  if (!profile) return { title: 'Nie znaleźliśmy tej strony — Profilo' };
  const { displayName, headline } = profile.content;
  return { title: headline ? `${displayName} — ${headline}` : displayName };
}

export default async function PublicPage({ params }: Props) {
  const { nick, profile } = await load(params);
  if (!profile) notFound();
  // One address per page: /user/Anna-Wisniewska → /user/anna-wisniewska.
  if (profile.nick !== nick) permanentRedirect(`/user/${profile.nick}`);
  return <Page profile={profile} />;
}
