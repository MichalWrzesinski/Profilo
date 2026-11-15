import type { Metadata } from 'next';
import { SAMPLE_PROFILE } from '@/features/landing/sample';
import { PublicPage } from '@/features/public/PublicPage';

export const metadata: Metadata = {
  title: 'Przykładowa strona — Profilo',
  robots: { index: false, follow: false },
};

/** The example page shown in the phone frame on the landing (framed by the same origin). */
export default function ExamplePage() {
  return <PublicPage profile={SAMPLE_PROFILE} />;
}
