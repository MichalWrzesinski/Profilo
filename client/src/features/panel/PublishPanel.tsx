'use client';

import { Check, EyeOff, Pencil, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/Alert';
import { draftToPublic } from '@/features/preview/draftToPublic';
import { LivePreview } from '@/features/preview/LivePreview';
import { api, type Problem } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { BlockedNotice } from './BlockedNotice';
import { type OwnerProfile, usePanelProfile } from './PanelProfile';
import styles from './PublishPanel.module.css';

function badge(profile: OwnerProfile): { className: string; label: string } {
  if (profile.status === 'blocked')
    return { className: 'badge-danger is-off', label: 'Zablokowana' };
  if (profile.status === 'published') {
    return profile.hasUnpublishedChanges
      ? { className: 'badge-warning is-live', label: 'Masz nieopublikowane zmiany' }
      : { className: 'badge-success is-live', label: 'Opublikowana' };
  }
  if (profile.status === 'unpublished')
    return { className: 'badge-neutral is-off', label: 'Ukryta' };
  return { className: 'badge-neutral is-off', label: 'Nieopublikowana' };
}

const DATE = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * „Twoja strona”: a thumbnail of the draft, the status, the address and the publish / unpublish
 * actions (PRF-US-9, PRF-BR-16, PRF-BR-17).
 */
export function PublishPanel() {
  const { account } = useSession();
  const { profile, loadFailed, setProfile } = usePanelProfile();
  const preview = useMemo(() => (profile ? draftToPublic(profile) : null), [profile]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loadFailed) {
    return <Alert variant="danger">Nie udało się wczytać Twojej strony. Odśwież stronę</Alert>;
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
    ? 'Strona jest zablokowana — napisz do nas, jeśli to pomyłka'
    : !confirmed
      ? 'Potwierdź adres e-mail, żeby opublikować stronę'
      : !profile.nick
        ? 'Najpierw wybierz adres strony w kreatorze'
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
        return setError('Strona zmieniła się w innym oknie. Sprawdź ją i opublikuj ponownie');
      }
      setError(details?.detail ?? 'Nie udało się zapisać zmiany. Spróbuj ponownie');
    } catch {
      setError('Nie udało się połączyć. Sprawdź połączenie i spróbuj ponownie');
    } finally {
      setBusy(false);
    }
  };

  const status = badge(profile);
  return (
    <div className={styles.wrap}>
      {blocked && (
        <div className={styles.notice}>
          <BlockedNotice />
        </div>
      )}
      <section className={`card card-pad ${styles.panel}`} aria-labelledby="page-status">
        {/* A picture of the page, not a second copy to tab or read through. */}
        <div className={styles.thumb} inert aria-hidden="true">
          <LivePreview
            profile={preview!}
            device="phone"
            label="Miniatura Twojej strony"
            className={styles.thumbBox}
          />
        </div>
        <div className={styles.body}>
          <div className={styles.row}>
            <h2 id="page-status" className={styles.title}>
              Twoja strona
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
          {profile.publishedAt && (
            <p className={`hint ${styles.published}`}>
              Ostatnia publikacja: {DATE.format(new Date(profile.publishedAt))}
            </p>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
          <div className={styles.actions}>
            <button
              type="button"
              className={`btn btn-primary btn-sm${busy ? ' is-loading' : ''}`}
              disabled={busy || blocker !== null || nothingToPublish}
              aria-describedby={blocker ? 'publish-blocker' : undefined}
              onClick={() => void run('publish')}
            >
              <Upload className="i sm" aria-hidden="true" />
              {publishLabel}
            </button>
            {published && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => void run('unpublish')}
              >
                <EyeOff className="i sm" aria-hidden="true" />
                Ukryj stronę
              </button>
            )}
            <Link className="btn btn-secondary btn-sm" href="/edytor">
              <Pencil className="i sm" aria-hidden="true" />
              Edytuj stronę
            </Link>
          </div>
          {blocker && (
            <p id="publish-blocker" className="hint">
              {blocker}
            </p>
          )}
          {nothingToPublish && !blocker && (
            <p className="hint">
              <Check className="i sm" aria-hidden="true" />
              Wszystkie zmiany są już na stronie
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
