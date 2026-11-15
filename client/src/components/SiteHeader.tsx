import Link from 'next/link';
import { Brand } from './Brand';
import styles from './SiteHeader.module.css';

/** Top bar of the service's own pages (home, legal pages): fits a 320 px screen. */
export function SiteHeader() {
  return (
    <header className={`topbar ${styles.bar}`}>
      <Brand />
      <span className="spacer" />
      <Link className="btn btn-ghost btn-sm" href="/logowanie">
        Zaloguj się
      </Link>
      <Link className="btn btn-primary btn-sm" href="/rejestracja">
        Załóż stronę
      </Link>
    </header>
  );
}
