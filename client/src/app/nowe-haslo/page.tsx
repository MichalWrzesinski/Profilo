import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { NewPasswordForm } from '@/features/auth/NewPasswordForm';

export const metadata: Metadata = {
  title: 'Nowe hasło — Profilo',
  robots: { index: false },
  referrer: 'no-referrer', // the token in the URL must not leak to other sites
};

export default function NewPasswordPage() {
  return (
    <AuthCard title="Ustaw nowe hasło">
      <Suspense>
        <NewPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
