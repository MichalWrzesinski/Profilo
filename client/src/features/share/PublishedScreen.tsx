'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/Alert';
import { Brand } from '@/components/Brand';
import type { OwnerProfile } from '@/features/editor/fields';
import { api } from '@/lib/api/client';
import { SharePanel } from './SharePanel';
import styles from './PublishedScreen.module.css';

/** „Gotowe! Twoja strona jest online” after the first publication (PRF-BR-19, PUB-US-6). */
export function PublishedScreen() {
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .GET('/api/v1/me/profile')
      .then(({ data }) => (data ? setProfile(data) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  return (
    <>
      <header className="topbar">
        <Brand />
        <span className="spacer" />
        <Link className="btn btn-secondary btn-sm" href="/edytor">
          Przejdź do edytora
        </Link>
      </header>
      <main className={styles.done}>
        {failed ? (
          <Alert variant="danger">Nie udało się wczytać Twojej strony. Odśwież stronę.</Alert>
        ) : !profile ? (
          <p className="muted" role="status">
            Wczytywanie…
          </p>
        ) : profile.publicUrl && profile.nick ? (
          <>
            <div className={styles.ok}>
              <Check className="i" aria-hidden="true" />
            </div>
            <h1>Gotowe! Twoja strona jest online</h1>
            <p className={`muted ${styles.lead}`}>
              Wstaw ten adres do CV, stopki e-mail albo na wizytówkę.
            </p>
            <SharePanel publicUrl={profile.publicUrl} nick={profile.nick} />
          </>
        ) : (
          <>
            <h1>Strona nie jest opublikowana</h1>
            <p className={`muted ${styles.lead}`}>Opublikuj ją w edytorze, żeby ją udostępnić.</p>
            <Link className="btn btn-primary" href="/edytor">
              Przejdź do edytora
            </Link>
          </>
        )}
      </main>
    </>
  );
}
