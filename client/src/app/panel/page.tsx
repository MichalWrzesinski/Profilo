'use client';

import Link from 'next/link';
import { PublishPanel } from '@/features/panel/PublishPanel';
import { useSession } from '@/lib/session';

export default function PanelPage() {
  const { account } = useSession();
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-10) var(--space-5)' }}>
      <h1 style={{ fontSize: 'var(--text-xl)' }}>Twoja strona</h1>
      <p className="muted" style={{ marginBottom: 'var(--space-6)' }}>
        Zalogowano jako {account?.email}.
      </p>
      <PublishPanel />
      <p style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <Link className="btn btn-primary" href="/edytor">
          Edytuj stronę
        </Link>
        <Link className="btn btn-secondary" href="/kreator">
          Przejdź do kreatora
        </Link>
      </p>
    </main>
  );
}
