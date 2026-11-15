'use client';

import type { ReactNode } from 'react';
import { useRequireSession } from '@/lib/useRequireSession';

export default function EditorLayout({ children }: { children: ReactNode }) {
  const { status } = useRequireSession();
  if (status !== 'authenticated') {
    return (
      <p className="muted" role="status" style={{ padding: 'var(--space-8)' }}>
        Wczytywanie…
      </p>
    );
  }
  return children;
}
