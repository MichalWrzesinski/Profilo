'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Brand } from '@/components/Brand';
import styles from '@/components/NotFoundPage.module.css';

/** Shown when a page fails on the server or in the browser, e.g. the API is down. */
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  // The error boundary catches the error, so it is reported here (scrubbed, TASK-023).
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
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
