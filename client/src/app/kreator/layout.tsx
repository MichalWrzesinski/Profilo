'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { ConfirmEmailBanner } from '@/features/auth/ConfirmEmailBanner';
import { Stepper } from '@/features/wizard/Stepper';
import { useRequireSession } from '@/lib/useRequireSession';

export default function WizardLayout({ children }: { children: ReactNode }) {
  const { status } = useRequireSession();

  if (status !== 'authenticated') {
    return (
      <p className="muted" role="status" style={{ padding: 'var(--space-8)' }}>
        Wczytywanie…
      </p>
    );
  }
  return (
    <>
      <header className="topbar">
        <Brand withName={false} />
        <Stepper step={1} label="Nazwa i adres" />
        <span className="spacer" />
        <Link className="btn btn-ghost btn-sm" href="/panel">
          <span className="hide-m">Dokończę&nbsp;</span>później
        </Link>
      </header>
      <ConfirmEmailBanner />
      {children}
    </>
  );
}
