import Link from 'next/link';
import styles from './Landing.module.css';

/** Footer of the service's own pages: home and legal pages (PUB-BR-11). */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <span>© 2026 Profilo</span>
      <Link href="/regulamin">Regulamin</Link>
      <Link href="/prywatnosc">Polityka prywatności</Link>
    </footer>
  );
}
