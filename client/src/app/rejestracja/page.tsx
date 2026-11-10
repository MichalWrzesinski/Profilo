import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';
import { RegisterForm } from '@/features/auth/RegisterForm';

export const metadata: Metadata = { title: 'Załóż stronę — Profilo', robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Załóż swoją stronę"
      lead="Zajmie to około 5 minut."
      topbarAction={
        <Link className="btn btn-ghost btn-sm" href="/logowanie">
          Zaloguj się
        </Link>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
