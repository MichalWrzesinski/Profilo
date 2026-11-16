import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { normaliseNickInput } from '@/lib/nick';

export const metadata: Metadata = { title: 'Załóż stronę — Profilo', robots: { index: false } };

type Props = { searchParams: Promise<{ adres?: string | string[] }> };

export default async function RegisterPage({ searchParams }: Props) {
  // „Zarezerwuj adres” on the landing: the address goes on to wizard step 1.
  const raw = (await searchParams).adres;
  const nick = normaliseNickInput(String(Array.isArray(raw) ? raw[0] : (raw ?? '')).trim())
    .slice(0, 40)
    .replace(/-+$/, '');
  return (
    <AuthCard
      title="Załóż swoją stronę"
      lead={
        nick
          ? `Zajmie to około 5 minut. Adres „${nick}” sprawdzimy i zarezerwujemy w następnym kroku.`
          : 'Zajmie to około 5 minut.'
      }
      topbarAction={
        <Link className="btn btn-primary btn-sm" href="/logowanie">
          Zaloguj się
        </Link>
      }
    >
      <RegisterForm nick={nick || undefined} />
    </AuthCard>
  );
}
