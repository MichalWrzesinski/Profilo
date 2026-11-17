'use client';

import Link from 'next/link';
import { PublishPanel } from '@/features/panel/PublishPanel';

export default function PanelPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-10) var(--space-5)' }}>
      <h1 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-6)' }}>Twoja strona</h1>
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
