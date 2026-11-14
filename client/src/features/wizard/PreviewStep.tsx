'use client';

import { Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/Alert';
import type { OwnerProfile } from '@/features/editor/fields';
import { draftToPublic } from '@/features/preview/draftToPublic';
import { DeviceToggle, LivePreview, type Device } from '@/features/preview/LivePreview';
import { api, type Problem } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import styles from './PreviewStep.module.css';
import { WizardBar } from './WizardBar';

/** Wizard step 4: the draft as visitors will see it, then „Opublikuj stronę” (PRF-US-1). */
export function PreviewStep() {
  const router = useRouter();
  const { account } = useSession();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [device, setDevice] = useState<Device>('desktop');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (profile ? draftToPublic(profile) : null), [profile]);

  useEffect(() => {
    api
      .GET('/api/v1/me/profile')
      .then(({ data }) => (data ? setProfile(data) : setLoadFailed(true)))
      .catch(() => setLoadFailed(true));
  }, []);

  if (loadFailed) {
    return (
      <main className={styles.main}>
        <Alert variant="danger">Nie udało się wczytać Twojej strony. Odśwież stronę.</Alert>
      </main>
    );
  }
  if (!profile) {
    return (
      <p className="muted" role="status" style={{ padding: 'var(--space-8)' }}>
        Wczytywanie…
      </p>
    );
  }

  const confirmed = account?.emailConfirmed ?? false;
  const hint = !confirmed
    ? 'Najpierw potwierdź e-mail'
    : !profile.nick
      ? 'Najpierw wybierz adres strony'
      : profile.status === 'blocked'
        ? 'Strona jest zablokowana'
        : null;

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const { data, error: problem } = await api.POST('/api/v1/me/profile/publish', {
        body: { version: profile.version },
      });
      if (data) {
        router.push('/edytor?opublikowano=1');
        return;
      }
      const details = problem as (Problem & { current?: OwnerProfile }) | undefined;
      if (details?.code === 'draft_conflict' && details.current) {
        setProfile(details.current);
        setError('Strona zmieniła się w innym oknie. Sprawdź podgląd i opublikuj ponownie.');
      } else {
        setError(details?.detail ?? 'Nie udało się opublikować. Spróbuj ponownie.');
      }
    } catch {
      setError('Nie udało się opublikować. Sprawdź połączenie i spróbuj ponownie.');
    }
    setPublishing(false);
  };

  return (
    <>
      <main className={styles.main}>
        <h1 className={styles.title}>Tak zobaczą Cię odwiedzający</h1>
        <p className={styles.lead}>
          Sprawdź stronę na komputerze i telefonie. Możesz wrócić i coś poprawić.
        </p>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className={styles.toggle}>
          <DeviceToggle device={device} onChange={setDevice} />
        </div>
        <div className={styles.preview}>
          <LivePreview profile={preview!} device={device} />
        </div>
      </main>
      <WizardBar>
        <Link className="btn btn-secondary" href="/kreator/tresc">
          ← Popraw treść
        </Link>
        <span className={styles.publish}>
          {hint && (
            <span id="publish-hint" className="hint">
              <Info className="i sm" aria-hidden="true" />
              {hint}
            </span>
          )}
          <button
            type="button"
            className={`btn btn-primary${publishing ? ' is-loading' : ''}`}
            disabled={hint !== null || publishing}
            aria-describedby={hint ? 'publish-hint' : undefined}
            onClick={() => void publish()}
          >
            {profile.status === 'published' ? 'Opublikuj zmiany' : 'Opublikuj stronę'}
          </button>
        </span>
      </WizardBar>
    </>
  );
}
