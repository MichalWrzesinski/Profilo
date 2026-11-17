'use client';

import type { ReactNode } from 'react';
import { AccountHeader } from '@/components/AccountHeader';
import { ConfirmEmailBanner } from '@/features/auth/ConfirmEmailBanner';
import { PanelProfileProvider } from '@/features/panel/PanelProfile';
import { useRequireSession } from '@/lib/useRequireSession';

export default function PanelLayout({ children }: { children: ReactNode }) {
  const { status } = useRequireSession();
  if (status !== 'authenticated') {
    return (
      <p className="muted" role="status" style={{ padding: 'var(--space-8)' }}>
        Wczytywanie…
      </p>
    );
  }
  return (
    <PanelProfileProvider>
      <AccountHeader />
      <ConfirmEmailBanner />
      {children}
    </PanelProfileProvider>
  );
}
