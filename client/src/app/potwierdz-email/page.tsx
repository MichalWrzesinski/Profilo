import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { ConfirmEmail } from '@/features/auth/ConfirmEmail';

export const metadata: Metadata = {
  title: 'Potwierdzenie adresu e-mail — Profilo',
  robots: { index: false },
  referrer: 'no-referrer', // the token in the URL must not leak to other sites
};

export default function ConfirmEmailPage() {
  return (
    <AuthCard title="Potwierdzenie adresu e-mail">
      <Suspense>
        <ConfirmEmail />
      </Suspense>
    </AuthCard>
  );
}
