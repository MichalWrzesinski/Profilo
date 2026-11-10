'use client';

import Link from 'next/link';
import { useSession } from '@/lib/session';

export default function PanelPage() {
  const { account } = useSession();
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-10) var(--space-5)' }}>
      <h1 style={{ fontSize: 'var(--text-xl)' }}>Twoja strona</h1>
      <p className="muted">Zalogowano jako {account?.email}.</p>
      <p>
        <Link className="btn btn-primary" href="/kreator">
          Przejdź do kreatora
        </Link>
      </p>
    </main>
  );
}
