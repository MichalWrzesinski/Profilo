import type { Metadata } from 'next';
import { AuthCard } from '@/components/AuthCard';

export const metadata: Metadata = { title: 'Polityka prywatności — Profilo' };

export default function Page() {
  return (
    <AuthCard title="Polityka prywatności">
      <p>Dokument w przygotowaniu.</p>
    </AuthCard>
  );
}
