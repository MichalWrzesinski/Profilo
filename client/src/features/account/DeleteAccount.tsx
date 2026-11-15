'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/Alert';
import { Field } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { problemMessage } from '@/features/auth/messages';
import { api, tokenStore, type Problem } from '@/lib/api/client';
import { clearDrafts } from '@/lib/draftStorage';
import styles from './AccountSettings.module.css';
import { markDeleted } from './SignOutAfterDeletion';

type Props = { publicUrl: string | null };

/** Danger zone: delete the account with the password (ACC-US-6, ACC-BR-9). */
export function DeleteAccount({ publicUrl }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false); // set at once, before React renders the busy state

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setError(null);
    setAlert(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending.current) return; // a second Enter while the first request runs
    if (!password) return setError('Wpisz hasło, aby potwierdzić.');
    sending.current = true;
    setBusy(true);
    setError(null);
    setAlert(null);
    try {
      const { response, error: problem } = await api.POST('/api/v1/me/deletion', {
        body: { password },
      });
      if (response.status === 204) {
        // The goodbye page signs out (outside the panel, whose guard would send an
        // anonymous visitor to the login page first); the flag tells it this is real.
        markDeleted();
        // Also here, in case the flag cannot be stored: the server has revoked everything.
        tokenStore.set(null);
        clearDrafts();
        router.replace('/konto-usuniete');
        return;
      }
      const details = problem as Problem | undefined;
      if (details?.code === 'invalid_password') setError('Hasło jest nieprawidłowe.');
      else setAlert(problemMessage(details));
    } catch {
      setAlert('Nie udało się połączyć. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <section className={`card card-pad ${styles.danger}`} aria-labelledby="delete-title">
      <h2 id="delete-title">Usuń konto</h2>
      <p className="muted">
        Usuniemy Twoje konto, stronę, zdjęcia i linki. Tego nie da się cofnąć.
      </p>
      <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
        Usuń konto
      </button>
      {open && (
        <Modal labelledBy="delete-dialog-title" describedBy="delete-dialog-text" onClose={close}>
          <form method="post" onSubmit={(event) => void submit(event)} noValidate>
            <h2 id="delete-dialog-title">Usunąć konto na zawsze?</h2>
            <p id="delete-dialog-text" className={`muted ${styles.small}`}>
              Usuniemy Twoją stronę, zdjęcia i wszystkie dane.{' '}
              {publicUrl && (
                <>
                  Adres <b>{publicUrl.replace(/^https?:\/\//, '')}</b> przestanie działać od
                  razu.{' '}
                </>
              )}
              Tego nie da się cofnąć.
            </p>
            {alert && <Alert variant="danger">{alert}</Alert>}
            <Field
              label="Wpisz hasło, aby potwierdzić"
              type="password"
              autoComplete="current-password"
              value={password}
              error={error ?? undefined}
              data-autofocus
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="actions">
              <button type="button" className="btn btn-secondary" onClick={close}>
                Anuluj
              </button>
              <button
                type="submit"
                className={`btn btn-danger${busy ? ' is-loading' : ''}`}
                aria-disabled={busy}
              >
                Usuń konto
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
