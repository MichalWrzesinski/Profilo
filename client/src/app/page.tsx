import type { Metadata } from 'next';
import { Landing } from '@/features/landing/Landing';
import { SAMPLE_PROFILE } from '@/features/landing/sample';
import { siteUrl } from '@/lib/site';

const TITLE = 'Profilo — Twoja wizytówka w sieci';
const DESCRIPTION =
  'Jeden stały adres z opisem, kontaktem i linkami do Twoich profili. Gotowy w 5 minut, bezpłatnie.';

export function generateMetadata(): Metadata {
  const url = `${siteUrl()}/`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: 'Profilo',
      locale: 'pl_PL',
      title: TITLE,
      description: DESCRIPTION,
    },
    twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  };
}

// The address prefix shows the real domain (PUBLIC_BASE_URL, read per request).
export const dynamic = 'force-dynamic';

export default function Home() {
  const site = siteUrl();
  return <Landing host={new URL(site).host} exampleUrl={`${site}/user/${SAMPLE_PROFILE.nick}`} />;
}
