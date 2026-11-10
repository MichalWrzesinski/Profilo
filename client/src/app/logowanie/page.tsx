import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';
import { LoginForm } from '@/features/auth/LoginForm';

export const metadata: Metadata = { title: 'Zaloguj się — Profilo', robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthCard
      title="Zaloguj się"
      lead="Wróć do edycji swojej strony."
      topbarAction={
        <Link className="btn btn-primary btn-sm" href="/rejestracja">
          Załóż stronę
        </Link>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
