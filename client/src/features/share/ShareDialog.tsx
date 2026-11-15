'use client';

import { X } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { SharePanel } from './SharePanel';
import styles from './ShareDialog.module.css';

type Props = { publicUrl: string; nick: string; onClose: () => void };

/** „Udostępnij: adres i kod QR” from the editor: the share panel in a modal dialog. */
export function ShareDialog({ publicUrl, nick, onClose }: Props) {
  return (
    <Modal labelledBy="share-title" className={styles.dialog} onClose={onClose}>
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
    </Modal>
  );
}
