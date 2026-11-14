'use client';

import { CircleAlert, Eye } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/Alert';
import { Brand } from '@/components/Brand';
import { ConfirmEmailBanner } from '@/features/auth/ConfirmEmailBanner';
import { api, type Problem } from '@/lib/api/client';
import { PHONE_COUNTRIES } from '@/lib/phone';
import { draftStorageKey } from '@/lib/draftStorage';
import { useSession } from '@/lib/session';
import styles from './Editor.module.css';
import { LIMITS, charCount, draftKeyOf, type OwnerProfile, type Values } from './fields';
import { LinksSection } from './LinksSection';
import { useAutosave, type SaveStatus } from './useAutosave';

/** Loads the draft, then mounts the editor (the autosave hook needs the first version). */
export function Editor() {
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
      <main className={styles.message}>
        <Alert variant="danger">Nie udało się wczytać Twojej strony. Odśwież stronę.</Alert>
      </main>
    );
  }
  if (!profile || !account) return <EditorLoading />;
  return (
    <EditorView
      initial={profile}
      storageKey={draftStorageKey(account.id)}
      emailConfirmed={account.emailConfirmed}
    />
  );
}

/** Loading state as in the #editor-loading mockup. */
function EditorLoading() {
  const sk = (height: number, width = '100%') => (
    <div className="skel" style={{ height, width, marginBottom: 12 }} />
  );
  return (
    <>
      <header className="topbar">
        <Brand withName={false} />
        <span className="save-state" role="status">
          <span className="spinner" aria-hidden="true" />
          Wczytywanie…
        </span>
      </header>
      <div className={styles.ed} aria-hidden="true">
        <div className={styles.form}>
          {[0, 1].map((n) => (
            <div key={n} className="panel-sec">
              <header>{sk(16, '30%')}</header>
              <div className="body">
                {sk(44)}
                {sk(44)}
                {sk(96)}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.preview}>
          <div className={styles.frame}>
            {sk(240)}
            {sk(28, '60%')}
          </div>
        </div>
      </div>
    </>
  );
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Zapisano',
  saving: 'Zapisywanie…',
  error: 'Nie zapisano',
  conflict: 'Nie zapisano',
};

function SaveState({ status, invalid }: { status: SaveStatus; invalid: boolean }) {
  const failed = status === 'error' || status === 'conflict' || invalid;
  return (
    <span className={`save-state${failed ? ' is-error' : ''}`} role="status" aria-live="polite">
      {status === 'saving' ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        <span className="dot" aria-hidden="true" />
      )}
      {invalid && status === 'saved' ? 'Nie zapisano' : STATUS_LABEL[status]}
    </span>
  );
}

function badge(profile: OwnerProfile): { className: string; label: string } | null {
  if (profile.status === 'blocked') return { className: 'badge-danger', label: 'Zablokowana' };
  if (profile.status !== 'published')
    return { className: 'badge-neutral', label: 'Nieopublikowana' };
  return profile.hasUnpublishedChanges
    ? { className: 'badge-warning', label: 'Masz nieopublikowane zmiany' }
    : null;
}

type ViewProps = { initial: OwnerProfile; storageKey: string; emailConfirmed: boolean };

function EditorView({ initial, storageKey, emailConfirmed }: ViewProps) {
  const router = useRouter();
  const draft = useAutosave(initial, storageKey);
  const { profile, values, errors, status } = draft;
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const published = profile.status === 'published';
  const canPublish =
    !draft.unsaved &&
    !publishing &&
    emailConfirmed &&
    Boolean(profile.nick) &&
    profile.status !== 'blocked' &&
    !(published && !profile.hasUnpublishedChanges);
  const publishHint = !emailConfirmed
    ? 'Potwierdź adres e-mail, żeby opublikować stronę.'
    : !profile.nick
      ? 'Najpierw wybierz adres strony w kreatorze.'
      : draft.unsaved
        ? 'Opublikujesz, gdy wszystkie zmiany będą zapisane.'
        : undefined;

  const publish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const { data, error } = await api.POST('/api/v1/me/profile/publish', {
        body: { version: profile.version },
      });
      if (data) draft.applyPublished(data);
      else setPublishError((error as Problem | undefined)?.detail ?? 'Nie udało się opublikować.');
    } catch {
      setPublishError('Nie udało się opublikować. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setPublishing(false);
    }
  };

  const status_ = badge(profile);
  const field = (input: keyof Values) => {
    const key = draftKeyOf(input);
    const error = errors[key];
    return {
      id: `ed-${input}`,
      className: `input${error ? ' is-error' : ''}`,
      value: values[input],
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `ed-${key}-error` : undefined,
      onChange: (event: { target: { value: string } }) => draft.edit(input, event.target.value),
    };
  };
  // The region is always rendered so screen readers announce an error when it appears.
  const errorOf = (key: keyof typeof errors) => (
    <span id={`ed-${key}-error`} aria-live="polite" className={styles.errorSlot}>
      {errors[key] && (
        <span className="hint is-error">
          <CircleAlert className="i sm" aria-hidden="true" />
          {errors[key]}
        </span>
      )}
    </span>
  );

  return (
    <>
      <header className="topbar">
        <Brand withName={false} />
        <SaveState status={draft.shownStatus} invalid={draft.invalid} />
        <span className="spacer" />
        {status_ && <span className={`badge ${status_.className} hide-m`}>{status_.label}</span>}
        <Link
          className="btn btn-ghost btn-sm"
          href="/panel"
          onClick={async (event) => {
            // Opening the panel in a new tab (Cmd/Ctrl/Shift or middle click) leaves this one as is.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            if (!draft.unsaved) return;
            // Save the change typed a moment ago before the panel reads the draft.
            event.preventDefault();
            const saved = await draft.settle();
            const leave =
              saved ||
              window.confirm(
                'Część zmian nie jest zapisana. Zostaną w tej przeglądarce do następnej edycji. Wyjść?',
              );
            if (leave) router.push('/panel');
          }}
        >
          Panel
        </Link>
        <button
          type="button"
          className={`btn btn-primary btn-sm${publishing ? ' is-loading' : ''}`}
          disabled={!canPublish}
          title={publishHint}
          aria-describedby={publishHint ? 'ed-publish-hint' : undefined}
          onClick={() => void publish()}
        >
          {published ? 'Opublikuj zmiany' : 'Opublikuj'}
        </button>
        {publishHint && (
          <span id="ed-publish-hint" className="sr-only">
            {publishHint}
          </span>
        )}
      </header>
      <div className={`tabs ${styles.tabsM}`} role="tablist" aria-label="Widok edytora">
        {(['edit', 'preview'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`ed-tab-${name}`}
            aria-controls={name === 'edit' ? 'ed-panel-edit' : 'ed-panel-preview'}
            aria-selected={tab === name}
            onClick={() => setTab(name)}
          >
            {name === 'edit' ? 'Edycja' : 'Podgląd'}
          </button>
        ))}
      </div>
      {status === 'error' && (
        <div className="alert alert-danger banner" role="alert">
          <CircleAlert className="i" aria-hidden="true" />
          <span className="grow">
            <b>Nie udało się zapisać zmian.</b> Sprawdź połączenie z internetem — Twoje zmiany są
            bezpieczne w tej karcie.
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={draft.retry}>
            Spróbuj ponownie
          </button>
        </div>
      )}
      {status === 'conflict' && (
        <div className="alert alert-danger banner" role="alert">
          <CircleAlert className="i" aria-hidden="true" />
          <span className="grow">
            <b>Szkic zmienił się w innym oknie — odśwież.</b> Twoje ostatnie zmiany z tej karty nie
            zostały zapisane.
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={draft.reload}>
            Odśwież
          </button>
        </div>
      )}
      {publishError && (
        <div className="alert alert-danger banner" role="alert">
          <span className="grow">{publishError}</span>
        </div>
      )}
      <ConfirmEmailBanner />

      <div className={styles.ed} data-tab={tab}>
        <div
          className={styles.form}
          id="ed-panel-edit"
          role="tabpanel"
          aria-labelledby="ed-tab-edit"
        >
          <section className="panel-sec" aria-labelledby="ed-about">
            <header>
              <h3 id="ed-about">O mnie</h3>
            </header>
            <div className="body">
              <div className="field">
                <label className="field-label" htmlFor="ed-displayName">
                  Imię i nazwisko lub pseudonim
                </label>
                <input {...field('displayName')} autoComplete="name" />
                {errorOf('displayName')}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="ed-headline">
                  Nagłówek <span className="opt">(opcjonalnie)</span>
                </label>
                <input {...field('headline')} placeholder="np. Projektantka UX/UI" />
                {errorOf('headline')}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="ed-bio">
                  Krótki opis <span className="opt">(opcjonalnie)</span>
                </label>
                <textarea
                  {...field('bio')}
                  rows={5}
                  placeholder="Kim jesteś i w czym możesz pomóc? 2–3 zdania wystarczą."
                />
                <span className="counter">
                  {charCount(values.bio.trim())} / {LIMITS.bio}
                </span>
                {errorOf('bio')}
              </div>
              <div className={styles.grid3}>
                <div className="field">
                  <label className="field-label" htmlFor="ed-position">
                    Stanowisko
                  </label>
                  <input {...field('position')} autoComplete="organization-title" />
                  {errorOf('position')}
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="ed-company">
                    Firma
                  </label>
                  <input {...field('company')} autoComplete="organization" />
                  {errorOf('company')}
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="ed-city">
                    Miejscowość
                  </label>
                  <input {...field('city')} autoComplete="address-level2" />
                  {errorOf('city')}
                </div>
              </div>
            </div>
          </section>

          <section className="panel-sec" aria-labelledby="ed-contact">
            <header>
              <h3 id="ed-contact">Kontakt</h3>
            </header>
            <div className="body">
              <div className="field">
                <label className="field-label" htmlFor="ed-publicEmail">
                  Publiczny e-mail <span className="opt">(opcjonalnie)</span>
                </label>
                <input
                  {...field('publicEmail')}
                  type="email"
                  autoComplete="off"
                  placeholder="np. kontakt@twojafirma.pl"
                />
                {!errors.publicEmail && (
                  <span className="hint">Może być inny niż e-mail do logowania.</span>
                )}
                {errorOf('publicEmail')}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="ed-phoneNational">
                  Telefon <span className="opt">(opcjonalnie)</span>
                </label>
                <div className={styles.phoneRow}>
                  <select
                    className="input"
                    aria-label="Kierunkowy kraju"
                    aria-invalid={errors.publicPhone ? true : undefined}
                    value={values.phoneCountry}
                    onChange={(event) => draft.edit('phoneCountry', event.target.value)}
                  >
                    {PHONE_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                  <input
                    {...field('phoneNational')}
                    className={`input${errors.publicPhone ? ' is-error' : ''}`}
                    type="tel"
                    autoComplete="tel-national"
                    aria-describedby={errors.publicPhone ? 'ed-publicPhone-error' : undefined}
                  />
                </div>
                {errorOf('publicPhone')}
              </div>
            </div>
          </section>

          <LinksSection links={profile.draft.links} run={draft.exclusive} busy={draft.busy} />
        </div>

        <aside
          className={styles.preview}
          id="ed-panel-preview"
          role="tabpanel"
          aria-labelledby="ed-tab-preview"
        >
          <div className={styles.bar}>
            <span className="label-caps">Podgląd wersji roboczej</span>
          </div>
          <div className={styles.frame}>
            <Eye className="i" aria-hidden="true" />
            <p>Podgląd na żywo pojawi się tu wkrótce.</p>
            {profile.publicUrl && (
              <a href={profile.publicUrl} target="_blank" rel="noopener">
                Zobacz opublikowaną stronę
              </a>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
