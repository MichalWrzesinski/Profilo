'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { SharePanel } from './SharePanel';
import styles from './ShareDialog.module.css';

type Props = { publicUrl: string; nick: string; onClose: () => void };

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/** „Udostępnij: adres i kod QR” from the editor: the share panel in a modal dialog. */
export function ShareDialog({ publicUrl, nick, onClose }: Props) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog.current) return;
      // Keep the focus inside the dialog while it is open.
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className={`modal ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <div className={styles.head}>
          <h2 id="share-title">Udostępnij stronę</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Zamknij"
            data-autofocus
            onClick={onClose}
          >
            <X className="i" aria-hidden="true" />
          </button>
        </div>
        <SharePanel publicUrl={publicUrl} nick={nick} />
      </div>
    </div>
  );
}
