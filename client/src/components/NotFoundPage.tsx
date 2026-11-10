import Link from 'next/link';
import { Brand } from './Brand';
import styles from './NotFoundPage.module.css';

/** The one 404 page: unknown, unpublished and blocked pages look the same (PUB-BR-6). */
export function NotFoundPage() {
  return (
    <main className={styles.center}>
      <div>
        <div className={styles.code} aria-hidden="true">
          404
        </div>
        <h1 className={styles.title}>Nie znaleźliśmy tej strony</h1>
        <p className={`muted ${styles.lead}`}>
          Adres może zawierać literówkę albo strona nie jest już publiczna.
        </p>
        <Link className="btn btn-primary" href="/rejestracja">
          Załóż własną stronę
        </Link>
        <div className={styles.brand}>
          <Brand />
        </div>
      </div>
    </main>
  );
}
