'use client';

import type { ReactNode } from 'react';
import { AccountMenu } from '@/components/AccountMenu';
import { Brand } from '@/components/Brand';
import { ConfirmEmailBanner } from '@/features/auth/ConfirmEmailBanner';
import { PanelProfileProvider, ViewProfileLink } from '@/features/panel/PanelProfile';
import { useRequireSession } from '@/lib/useRequireSession';
import styles from './Shell.module.css';

export default function PanelLayout({ children }: { children: ReactNode }) {
  const { status, account } = useRequireSession();
  if (status !== 'authenticated') {
    return (
      <p className="muted" role="status" style={{ padding: 'var(--space-8)' }}>
        Wczytywanie…
      </p>
    );
  }
  return (
    <PanelProfileProvider>
      <header className="topbar">
        <Brand nameOnPhones={false} />
        <span className="spacer" />
        <span className={`muted hide-m ${styles.account}`}>
          Zalogowano jako <b>{account?.email}</b>
        </span>
        <ViewProfileLink />
        <AccountMenu />
      </header>
      <ConfirmEmailBanner />
      {children}
    </PanelProfileProvider>
  );
}
