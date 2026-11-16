'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { ConfirmEmailBanner } from '@/features/auth/ConfirmEmailBanner';
import { useRequireSession } from '@/lib/useRequireSession';

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, signOut } = useRequireSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  // A disclosure, not an ARIA menu: Escape closes it and gives the focus back to the button.
  const onMenuKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !menuOpen) return;
    setMenuOpen(false);
    menuButton.current?.focus();
  };

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
        <div style={{ position: 'relative' }} onKeyDown={onMenuKey}>
          <button
            ref={menuButton}
            type="button"
            className="btn btn-primary btn-sm"
            aria-expanded={menuOpen}
            aria-controls="panel-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
          {menuOpen && (
            <nav
              id="panel-menu"
              className="menu"
              aria-label="Menu konta"
              style={{ position: 'absolute', right: 0, top: '110%' }}
            >
              {[
                { href: '/panel', label: 'Panel' },
                { href: '/panel/konto', label: 'Ustawienia konta' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  className="menu-item"
                  href={href}
                  aria-current={pathname === href ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <hr />
              <button
                type="button"
                className="menu-item"
                onClick={async () => {
                  await signOut();
                  router.replace('/logowanie');
                }}
              >
                Wyloguj się
              </button>
            </nav>
          )}
        </div>
      </header>
      <ConfirmEmailBanner />
      {children}
    </>
  );
}
