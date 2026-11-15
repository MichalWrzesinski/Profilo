import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';
import { ResetRequestForm } from '@/features/auth/ResetRequestForm';

export const metadata: Metadata = {
  title: 'Nie pamiętam hasła — Profilo',
  robots: { index: false },
};

export default function ResetRequestPage() {
  return (
    <AuthCard
      title="Nie pamiętasz hasła?"
      lead="Podaj e-mail do logowania. Wyślemy link do ustawienia nowego hasła."
      topbarAction={
        <Link className="btn btn-secondary btn-sm" href="/logowanie">
          Zaloguj się
        </Link>
      }
    >
      <ResetRequestForm />
    </AuthCard>
  );
}
