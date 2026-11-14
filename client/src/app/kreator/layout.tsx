'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { ConfirmEmailBanner } from '@/features/auth/ConfirmEmailBanner';
import { Stepper } from '@/features/wizard/Stepper';
import { WizardExitProvider, useWizardExitHandler } from '@/features/wizard/WizardExit';
import { useRequireSession } from '@/lib/useRequireSession';

const STEPS: Record<string, { step: number; label: string }> = {
  '/kreator': { step: 1, label: 'Nazwa i adres' },
  '/kreator/wyglad': { step: 2, label: 'Wygląd' },
  '/kreator/tresc': { step: 3, label: 'Treść' },
  '/kreator/podglad': { step: 4, label: 'Podgląd' },
};

export default function WizardLayout({ children }: { children: ReactNode }) {
  return (
    <WizardExitProvider>
      <WizardFrame>{children}</WizardFrame>
    </WizardExitProvider>
  );
}

function WizardFrame({ children }: { children: ReactNode }) {
  const { status } = useRequireSession();
  const current = STEPS[usePathname()] ?? STEPS['/kreator']!;
  const exit = useWizardExitHandler();

  if (status !== 'authenticated') {
    return (
      <p className="muted" role="status" style={{ padding: 'var(--space-8)' }}>
        Wczytywanie…
      </p>
    );
  }
  return (
    <>
      {/* A step may save first before the top-bar links leave it (step 3: pending edits). */}
      <header
        className="topbar"
        onClickCapture={(event) => {
          const link = (event.target as Element).closest('a');
          const leave = exit?.get();
          if (!link || !leave || event.metaKey || event.ctrlKey || event.shiftKey) return;
          event.preventDefault();
          leave(link.getAttribute('href') ?? '/edytor');
        }}
      >
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
