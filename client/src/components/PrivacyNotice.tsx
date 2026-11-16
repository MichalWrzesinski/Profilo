'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { Modal } from './Modal';

/** localStorage key set once the visitor has closed the notice. */
export const PRIVACY_NOTICE_KEY = 'profilo:privacy-notice';

// Owners' pages and the frames of the editor preview and the home page show no notice.
const WITHOUT_NOTICE = /^\/(user|podglad|przyklad)(\/|$)/;

function seen(): boolean {
  try {
    return window.localStorage.getItem(PRIVACY_NOTICE_KEY) === '1';
  } catch {
    return false; // Storage blocked: show it once per page load.
  }
}

const noSubscription = () => () => undefined;

/**
 * One notice about cookies and personal data on the service's own pages: only the necessary
 * cookie and browser storage are used (no consent needed), and the privacy policy explains how
 * the data people enter is processed. Closing it in any way counts as read.
 */
export function PrivacyNotice() {
  const pathname = usePathname();
  // The server and hydration render without it (no mismatch); React then reads the storage.
  const alreadySeen = useSyncExternalStore(noSubscription, seen, () => true);
  const [closed, setClosed] = useState(false);

  if (alreadySeen || closed || WITHOUT_NOTICE.test(pathname)) return null;

  const close = () => {
    try {
      window.localStorage.setItem(PRIVACY_NOTICE_KEY, '1');
    } catch {
      // Storage blocked: the notice comes back on the next visit.
    }
    setClosed(true);
  };

  return (
    <Modal labelledBy="privacy-notice-title" describedBy="privacy-notice-text" onClose={close}>
      <h2 id="privacy-notice-title">Pliki cookie i Twoje dane</h2>
      <div id="privacy-notice-text" className="muted">
        <p>
          Używamy tylko niezbędnego pliku cookie, który utrzymuje Twoje zalogowanie, oraz pamięci
          przeglądarki, m.in. na niezapisane zmiany i zapamiętanie, że zamknąłeś to okno. Nie
          używamy plików cookie reklamowych ani analitycznych.
        </p>
        <p style={{ marginTop: 'var(--space-3)' }}>
          Dane, które podajesz (np. imię i nazwisko, e-mail, telefon), przetwarzamy, żeby prowadzić
          Twoje konto i stronę. Szczegóły, podstawy prawne i Twoje prawa opisuje{' '}
          <Link href="/prywatnosc" onClick={close}>
            Polityka prywatności
          </Link>
          .
        </p>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" data-autofocus onClick={close}>
          Rozumiem
        </button>
      </div>
    </Modal>
  );
}
