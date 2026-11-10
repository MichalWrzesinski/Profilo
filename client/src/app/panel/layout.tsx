'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { ConfirmEmailBanner } from '@/features/auth/ConfirmEmailBanner';
import { useRequireSession } from '@/lib/useRequireSession';

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, signOut } = useRequireSession();
  const [menuOpen, setMenuOpen] = useState(false);

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
        <span className="spacer" />
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
          {menuOpen && (
            <div
              className="menu"
              role="menu"
              style={{ position: 'absolute', right: 0, top: '110%' }}
            >
              <button
                type="button"
                role="menuitem"
                className="btn btn-ghost btn-block"
                onClick={async () => {
                  await signOut();
                  router.replace('/logowanie');
                }}
              >
                Wyloguj się
              </button>
            </div>
          )}
        </div>
      </header>
      <ConfirmEmailBanner />
      {children}
    </>
  );
}
