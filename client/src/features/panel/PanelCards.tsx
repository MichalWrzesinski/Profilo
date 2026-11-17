'use client';

import {
  Check,
  CircleCheck,
  Circle,
  Copy,
  Download,
  LayoutTemplate,
  Link2,
  Pencil,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { shortAddress, useCopyLink, useQrDownload, useQrPreview } from '@/features/share/useShare';
import { usePanelProfile, type OwnerProfile } from './PanelProfile';
import styles from './PanelCards.module.css';

const MAX_LINKS = 20;
const ENOUGH_LINKS = 3;

/** First word of the display name, for „Cześć, Anna”. */
export function firstName(profile: OwnerProfile | null): string | null {
  return profile?.draft.displayName.trim().split(/\s+/)[0] || null;
}

/** The page address, „Kopiuj adres” and the QR code to download; a hint before publishing. */
export function ShareCard() {
  const { profile } = usePanelProfile();
  const ready = profile?.status === 'published' && profile.publicUrl && profile.nick;
  return (
    <section className={`card card-pad ${styles.card}`} aria-labelledby="panel-share">
      <h2 id="panel-share" className={styles.title}>
        Udostępnij
      </h2>
      {ready ? (
        <ShareActions publicUrl={profile.publicUrl!} nick={profile.nick!} />
      ) : (
        <p className="muted">
          Po publikacji znajdziesz tu adres strony do skopiowania i kod QR do CV i na wizytówkę
        </p>
      )}
    </section>
  );
}

function ShareActions({ publicUrl, nick }: { publicUrl: string; nick: string }) {
  const address = shortAddress(publicUrl);
  const qr = useQrPreview();
  const { input, copied, copyFailed, copy } = useCopyLink(publicUrl);
  const { downloading, downloadFailed, download } = useQrDownload(nick);
  return (
    <>
      <div className={styles.qrRow}>
        <div className={styles.qr}>
          {qr.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL, not optimisable
            <img src={qr.src} alt={`Kod QR z adresem ${address}`} width={72} height={72} />
          ) : qr.failed ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={qr.retry}>
              Wczytaj kod
            </button>
          ) : (
            <span className="spinner" role="status" aria-label="Wczytywanie kodu QR" />
          )}
        </div>
        <p className="muted">Kod QR do CV i na wizytówkę</p>
      </div>
      <input
        ref={input}
        className="sr-only"
        readOnly
        value={address}
        aria-label="Adres strony"
        tabIndex={-1}
      />
      <div className={styles.buttons}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}>
          {copied ? (
            <Check className="i sm" aria-hidden="true" />
          ) : (
            <Copy className="i sm" aria-hidden="true" />
          )}
          {copied ? 'Skopiowano' : 'Kopiuj adres'}
        </button>
        {(['png', 'svg'] as const).map((format) => (
          <button
            key={format}
            type="button"
            className={`btn btn-secondary btn-sm${downloading === format ? ' is-loading' : ''}`}
            aria-disabled={downloading !== null}
            onClick={() => void download(format)}
          >
            <Download className="i sm" aria-hidden="true" />
            QR {format.toUpperCase()}
          </button>
        ))}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {copied ? 'Skopiowano link' : ''}
      </div>
      {copyFailed && (
        <p className={`hint ${styles.wrap}`} role="alert">
          Nie udało się skopiować. Skopiuj adres ręcznie: {address}
        </p>
      )}
      {downloadFailed && (
        <p className="hint is-error" role="alert">
          Nie udało się pobrać pliku. Spróbuj ponownie
        </p>
      )}
    </>
  );
}

type Step = { label: string; done: boolean };

export function completionSteps(profile: OwnerProfile): Step[] {
  const draft = profile.draft;
  return [
    { label: 'Zdjęcie profilowe', done: Boolean(draft.avatar) },
    { label: 'Krótki opis', done: Boolean(draft.bio?.trim()) },
    { label: 'E-mail lub telefon', done: Boolean(draft.publicEmail || draft.publicPhone) },
    { label: 'Adres strony', done: Boolean(profile.nick) },
    { label: `Co najmniej ${ENOUGH_LINKS} linki`, done: draft.links.length >= ENOUGH_LINKS },
    { label: 'Grafika tła', done: Boolean(draft.background) },
  ];
}

/** „Dokończ swoją stronę”: what is still missing, with a link to the editor. */
export function ChecklistCard() {
  const { profile } = usePanelProfile();
  if (!profile) return null;
  const steps = completionSteps(profile);
  const done = steps.filter((step) => step.done).length;
  const complete = done === steps.length;
  return (
    <section className={`card card-pad ${styles.card}`} aria-labelledby="panel-steps">
      <div className={styles.head}>
        <h2 id="panel-steps" className={styles.title}>
          {complete ? 'Twoja strona jest kompletna' : 'Dokończ swoją stronę'}
        </h2>
        <span className="muted">
          {done} z {steps.length}
        </span>
      </div>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Postęp uzupełniania strony"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
      >
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className={styles.steps}>
        {steps.map((step) => (
          <li key={step.label} className={step.done ? styles.done : undefined}>
            {step.done ? (
              <CircleCheck className="i sm" aria-hidden="true" />
            ) : (
              <Circle className="i sm" aria-hidden="true" />
            )}
            <span>
              {step.label}
              <span className="sr-only">{step.done ? ' — gotowe' : ' — do uzupełnienia'}</span>
            </span>
            {!step.done && (
              <Link href="/edytor" className={styles.add}>
                dodaj<span className="sr-only">: {step.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Four shortcuts under the cards. */
export function Shortcuts() {
  const { profile } = usePanelProfile();
  const links = profile?.draft.links.length ?? 0;
  const items = [
    { href: '/edytor', icon: Pencil, title: 'Treść', text: 'Nazwa, opis, kontakt' },
    { href: '/kreator/wyglad', icon: LayoutTemplate, title: 'Wygląd', text: 'Układ i kolor' },
    { href: '/edytor', icon: Link2, title: 'Linki', text: `${links} z ${MAX_LINKS}` },
    { href: '/panel/konto', icon: Settings, title: 'Konto', text: 'Hasło, usunięcie konta' },
  ];
  return (
    <nav className={styles.shortcuts} aria-label="Skróty">
      {items.map(({ href, icon: Icon, title, text }) => (
        <Link key={title} href={href} className={`card ${styles.shortcut}`}>
          <span className={styles.icon}>
            <Icon className="i" aria-hidden="true" />
          </span>
          <b>{title}</b>
          <span className="muted">{text}</span>
        </Link>
      ))}
    </nav>
  );
}
