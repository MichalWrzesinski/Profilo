'use client';

import { Brand } from '@/components/Brand';
import styles from '@/components/NotFoundPage.module.css';

/** Shown when a page fails on the server or in the browser, e.g. the API is down. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className={styles.center}>
      <div>
        <h1 className={styles.title}>Nie udało się wczytać strony</h1>
        <p className={`muted ${styles.lead}`}>Spróbuj za chwilę.</p>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Spróbuj ponownie
        </button>
        <div className={styles.brand}>
          <Brand />
        </div>
      </div>
    </main>
  );
}
