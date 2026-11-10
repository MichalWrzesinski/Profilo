import type { Metadata } from 'next';
import { AuthCard } from '@/components/AuthCard';

export const metadata: Metadata = { title: 'Regulamin — Profilo' };

export default function Page() {
  return (
    <AuthCard title="Regulamin">
      <p>Dokument w przygotowaniu.</p>
    </AuthCard>
  );
}
