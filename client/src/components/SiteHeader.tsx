'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useSession } from '@/lib/session';
import { Brand } from './Brand';
import { AccountHeader } from './AccountHeader';
import styles from './SiteHeader.module.css';

const noSubscription = () => () => undefined;

/**
 * Top bar of the service's own pages (home, legal pages): fits a 320 px screen.
 * Signed-in visitors get the same account navigation as the panel.
 */
export function SiteHeader({
  className,
  anonymousAction,
}: { className?: string; anonymousAction?: ReactNode } = {}) {
  const { status, resume, hasHint } = useSession();
  // While a likely session is being restored the buttons keep their place but stay hidden,
  // so a signed-in visitor never sees „Zaloguj się” flash first. The server and hydration
  // render without the hint (no mismatch); React then re-renders with the stored one.
  const hinted = useSyncExternalStore(noSubscription, hasHint, () => false);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    void resume().finally(() => setResumed(true));
  }, [resume]);
  const restoring = hinted && !resumed && status === 'unknown';

  if (status === 'authenticated') return <AccountHeader className={className} />;

  return (
    <header className={`topbar ${styles.bar}${className ? ` ${className}` : ''}`}>
      <Brand nameOnPhones={false} />
      <span className="spacer" />
      <div className={styles.actions} hidden={restoring}>
        {anonymousAction ?? (
          <>
            <Link className="btn btn-ghost btn-sm" href="/logowanie">
              Zaloguj się
            </Link>
            <Link className="btn btn-primary btn-sm" href="/rejestracja">
              Załóż stronę
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
