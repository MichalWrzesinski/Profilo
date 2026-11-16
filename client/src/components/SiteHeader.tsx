'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useSession } from '@/lib/session';
import { Brand } from './Brand';
import styles from './SiteHeader.module.css';

/**
 * Top bar of the service's own pages (home, legal pages): fits a 320 px screen.
 * A signed-in visitor gets the panel and sign-out instead of login and sign-up.
 */
export function SiteHeader() {
  const { status, resume, signOut } = useSession();

  useEffect(() => {
    void resume();
  }, [resume]);

  return (
    <header className={`topbar ${styles.bar}`}>
      <Brand />
      <span className="spacer" />
      {status === 'authenticated' ? (
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
            Wyloguj się
          </button>
          <Link className="btn btn-primary btn-sm" href="/panel">
            Moje konto
          </Link>
        </>
      ) : (
        <>
          <Link className="btn btn-ghost btn-sm" href="/logowanie">
            Zaloguj się
          </Link>
          <Link className="btn btn-primary btn-sm" href="/rejestracja">
            Załóż stronę
          </Link>
        </>
      )}
    </header>
  );
}
