'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSession } from '@/lib/session';
import { Brand } from './Brand';
import styles from './SiteHeader.module.css';

const noSubscription = () => () => undefined;

/**
 * Top bar of the service's own pages (home, legal pages): fits a 320 px screen.
 * A signed-in visitor gets the panel and sign-out instead of login and sign-up.
 */
export function SiteHeader() {
  const { status, resume, hasHint, signOut } = useSession();
  // While a likely session is being restored the buttons keep their place but stay hidden,
  // so a signed-in visitor never sees „Zaloguj się” flash first. The server and hydration
  // render without the hint (no mismatch); React then re-renders with the stored one.
  const hinted = useSyncExternalStore(noSubscription, hasHint, () => false);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    void resume().finally(() => setResumed(true));
  }, [resume]);
  const restoring = hinted && !resumed && status === 'unknown';

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
        <div className={styles.actions} hidden={restoring}>
          <Link className="btn btn-ghost btn-sm" href="/logowanie">
            Zaloguj się
          </Link>
          <Link className="btn btn-primary btn-sm" href="/rejestracja">
            Załóż stronę
          </Link>
        </div>
      )}
    </header>
  );
}
