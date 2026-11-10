'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/Alert';
import { api, type Problem } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { useSession } from '@/lib/session';
import styles from './PublishPanel.module.css';

type OwnerProfile = components['schemas']['OwnerProfile'];

function badge(profile: OwnerProfile): { className: string; label: string } {
  if (profile.status === 'blocked') return { className: 'badge-danger', label: 'Zablokowana' };
  if (profile.status === 'published') {
    return profile.hasUnpublishedChanges
      ? { className: 'badge-warning', label: 'Masz nieopublikowane zmiany' }
      : { className: 'badge-success', label: 'Opublikowana' };
  }
  if (profile.status === 'unpublished') return { className: 'badge-neutral', label: 'Ukryta' };
  return { className: 'badge-neutral', label: 'Nieopublikowana' };
}

/** Status of the page and the publish / unpublish actions (PRF-US-9, PRF-BR-16, PRF-BR-17). */
export function PublishPanel() {
  const { account } = useSession();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .GET('/api/v1/me/profile')
      .then(({ data }) => (data ? setProfile(data) : setLoadFailed(true)))
      .catch(() => setLoadFailed(true));
  }, []);

  if (loadFailed) {
    return <Alert variant="danger">Nie udało się wczytać Twojej strony. Odśwież stronę.</Alert>;
  }
  if (!profile) {
    return (
      <p className="muted" role="status">
        Wczytywanie…
      </p>
    );
  }

  const confirmed = account?.emailConfirmed ?? false;
  const published = profile.status === 'published';
  const blocked = profile.status === 'blocked';
  const blocker = blocked
    ? 'Strona jest zablokowana — napisz do nas, jeśli to pomyłka.'
    : !confirmed
      ? 'Potwierdź adres e-mail, żeby opublikować stronę.'
      : !profile.nick
        ? 'Najpierw wybierz adres strony w kreatorze.'
        : null;
  const publishLabel = published ? 'Opublikuj zmiany' : 'Opublikuj';
  const nothingToPublish = published && !profile.hasUnpublishedChanges;

  const run = async (action: 'publish' | 'unpublish') => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: problem } =
        action === 'publish'
          ? await api.POST('/api/v1/me/profile/publish', { body: { version: profile.version } })
          : await api.POST('/api/v1/me/profile/unpublish');
      if (data) return setProfile(data);
      const details = problem as (Problem & { current?: OwnerProfile }) | undefined;
      if (details?.code === 'draft_conflict' && details.current) {
        setProfile(details.current);
        return setError('Strona zmieniła się w innym oknie. Sprawdź ją i opublikuj ponownie.');
      }
      setError(details?.detail ?? 'Nie udało się zapisać zmiany. Spróbuj ponownie.');
    } catch {
      setError('Nie udało się połączyć. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  };

  const status = badge(profile);
  return (
    <section className={`card card-pad ${styles.panel}`} aria-labelledby="page-status">
      <div className={styles.row}>
        <h2 id="page-status" className={styles.title}>
          Status strony
        </h2>
        <span className={`badge ${status.className}`}>{status.label}</span>
      </div>
      {profile.publicUrl && (
        <p className={styles.address}>
          <a href={profile.publicUrl} target="_blank" rel="noopener">
            {profile.publicUrl.replace(/^https?:\/\//, '')}
          </a>
        </p>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      <div className={styles.actions}>
        <button
          type="button"
          className={`btn btn-primary${busy ? ' is-loading' : ''}`}
          disabled={busy || blocker !== null || nothingToPublish}
          aria-describedby={blocker ? 'publish-blocker' : undefined}
          onClick={() => void run('publish')}
        >
          {publishLabel}
        </button>
        {published && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void run('unpublish')}
          >
            Ukryj stronę
          </button>
        )}
      </div>
      {blocker && (
        <p id="publish-blocker" className="hint">
          {blocker}
        </p>
      )}
      {nothingToPublish && !blocker && <p className="hint">Wszystkie zmiany są już na stronie.</p>}
    </section>
  );
}
