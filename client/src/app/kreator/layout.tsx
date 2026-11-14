'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { ConfirmEmailBanner } from '@/features/auth/ConfirmEmailBanner';
import { Stepper } from '@/features/wizard/Stepper';
import { useRequireSession } from '@/lib/useRequireSession';

// Step 2 (layout and colour) comes with TASK-012; until then step 1 leads to step 3.
const STEPS: Record<string, { step: number; label: string }> = {
  '/kreator': { step: 1, label: 'Nazwa i adres' },
  '/kreator/tresc': { step: 3, label: 'Treść' },
  '/kreator/podglad': { step: 4, label: 'Podgląd' },
};

export default function WizardLayout({ children }: { children: ReactNode }) {
  const { status } = useRequireSession();
  const current = STEPS[usePathname()] ?? STEPS['/kreator']!;

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
        <Stepper step={current.step} label={current.label} />
        <span className="spacer" />
        <Link className="btn btn-ghost btn-sm" href="/edytor">
          <span className="hide-m">Dokończę&nbsp;</span>później
        </Link>
      </header>
      <ConfirmEmailBanner />
      {children}
    </>
  );
}
