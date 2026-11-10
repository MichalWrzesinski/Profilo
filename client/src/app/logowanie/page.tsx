import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/Alert';
import { AuthCard } from '@/components/AuthCard';
import { LoginForm } from '@/features/auth/LoginForm';

export const metadata: Metadata = { title: 'Zaloguj się — Profilo', robots: { index: false } };

type Props = { searchParams: Promise<{ potwierdzono?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { potwierdzono } = await searchParams;
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
      {potwierdzono === '1' && <Alert variant="success">Adres potwierdzony — zaloguj się.</Alert>}
      <LoginForm />
    </AuthCard>
  );
}
