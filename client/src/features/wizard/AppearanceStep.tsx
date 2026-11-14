'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/Alert';
import { AccentPicker, LayoutPicker } from '@/features/appearance/AppearancePicker';
import { useAutosave } from '@/features/editor/useAutosave';
import type { OwnerProfile } from '@/features/editor/fields';
import { api } from '@/lib/api/client';
import { draftStorageKey } from '@/lib/draftStorage';
import { useSession } from '@/lib/session';
import styles from './NickStep.module.css';
import { WizardBar } from './WizardBar';
import { useWizardExit } from './WizardExit';

/** Wizard step 2: layout and accent colour (PUB-US-1, PUB-US-2); saved like the editor. */
export function AppearanceStep() {
  const { account } = useSession();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .GET('/api/v1/me/profile')
      .then(({ data }) => (data ? setProfile(data) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <main className={styles.main}>
        <Alert variant="danger">Nie udało się wczytać Twojej strony. Odśwież stronę.</Alert>
      </main>
    );
  }
  if (!profile || !account) {
    return (
      <p className="muted" role="status" style={{ padding: 'var(--space-8)' }}>
        Wczytywanie…
      </p>
    );
  }
  return <Pickers initial={profile} storageKey={draftStorageKey(account.id)} />;
}

function Pickers({ initial, storageKey }: { initial: OwnerProfile; storageKey: string }) {
  const router = useRouter();
  const draft = useAutosave(initial, storageKey);
  const { unsaved, settle } = draft;

  const leaveTo = useCallback(
    async (href: string) => {
      const saved = !unsaved || (await settle());
      if (saved || window.confirm('Wybór nie jest zapisany. Wyjść mimo to?')) router.push(href);
    },
    [unsaved, settle, router],
  );
  const leave = useCallback((href: string) => void leaveTo(href), [leaveTo]);
  useWizardExit(leave);

  return (
    <>
      <main className={styles.main}>
        <h1 className={styles.title}>Wybierz układ</h1>
        <p className={styles.lead}>Zmienisz go w każdej chwili. Treść przeniesie się sama.</p>
        {draft.status === 'error' && (
          <Alert variant="danger">
            Nie udało się zapisać wyboru. Sprawdź połączenie i spróbuj ponownie.
          </Alert>
        )}
        <LayoutPicker value={draft.values.layout} onChange={(v) => draft.edit('layout', v)} />
        <h2 className={styles.subtitle}>Kolor przewodni</h2>
        <p className="hint">Każdy kolor jest sprawdzony pod kątem czytelności.</p>
        <AccentPicker value={draft.values.accent} onChange={(v) => draft.edit('accent', v)} />
      </main>
      <WizardBar>
        <button type="button" className="btn btn-secondary" onClick={() => leave('/kreator')}>
          ← Wstecz
        </button>
        <button type="button" className="btn btn-primary" onClick={() => leave('/kreator/tresc')}>
          Dalej: treść →
        </button>
      </WizardBar>
    </>
  );
}
