import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';
import { SignOutAfterDeletion } from '@/features/account/SignOutAfterDeletion';

export const metadata: Metadata = {
  title: 'Konto usunięte — Profilo',
  robots: { index: false },
};

export default function AccountDeletedPage() {
  return (
    <AuthCard
      title="Konto usunięte"
      lead="Usunęliśmy Twoje konto, stronę, zdjęcia i linki. Wysłaliśmy też potwierdzenie na Twój e-mail."
    >
      <SignOutAfterDeletion />
      <p className="muted">Jeśli zechcesz wrócić, możesz w każdej chwili założyć nowe konto.</p>
      <Link className="btn btn-secondary btn-block" href="/">
        Wróć na stronę główną
      </Link>
    </AuthCard>
  );
}
