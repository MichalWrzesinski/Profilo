'use client';

import { ArrowUpRight, Check, Copy, Download } from 'lucide-react';
import { useRef } from 'react';
import { shortAddress, useCopyLink, useQrDownload, useQrPreview } from './useShare';
import styles from './SharePanel.module.css';

export { shortAddress };

type Props = { publicUrl: string; nick: string };

/**
 * The page address with „Kopiuj link” and „Otwórz stronę”, and the QR code to download as
 * PNG or SVG (PUB-BR-12). Used on the „Opublikowano” screen and in the editor's share dialog.
 */
export function SharePanel({ publicUrl, nick }: Props) {
  const address = shortAddress(publicUrl);
  const qr = useQrPreview();
  const codeBox = useRef<HTMLDivElement>(null);
  const { input, copied, copyFailed, copy } = useCopyLink(publicUrl);
  const { downloading, downloadFailed, download } = useQrDownload(nick);

  return (
    <div className={styles.share}>
      <div className={`input-group stack-m ${styles.address}`}>
        <input
          ref={input}
          className="input"
          readOnly
          value={address}
          aria-label="Adres strony"
          onFocus={(event) => event.target.select()}
        />
        <button
          type="button"
          className={`btn btn-primary ${styles.copy}`}
          onClick={() => void copy()}
        >
          <Copy className="i sm" aria-hidden="true" />
          Kopiuj link
        </button>
      </div>
      {copyFailed && (
        <p className="hint" role="alert">
          Nie udało się skopiować. Adres jest zaznaczony — skopiuj go skrótem Ctrl+C (⌘C)
        </p>
      )}
      <p className={styles.open}>
        <a className="btn btn-secondary" href={publicUrl} target="_blank" rel="noopener">
          Otwórz stronę
          <ArrowUpRight className="i sm" aria-hidden="true" />
        </a>
      </p>

      <section className={`card card-pad ${styles.qr}`} aria-labelledby="share-qr">
        <h2 id="share-qr" className="label-caps">
          Kod QR do druku
        </h2>
        <div className={styles.code} ref={codeBox} tabIndex={-1}>
          {qr.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL, not optimisable
            <img src={qr.src} alt={`Kod QR z adresem ${address}`} width={148} height={148} />
          ) : qr.failed ? (
            <p className="hint">
              Nie udało się wczytać kodu.{' '}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  qr.retry();
                  codeBox.current?.focus(); // the button disappears; keep the focus here
                }}
              >
                Spróbuj ponownie
              </button>
            </p>
          ) : (
            <span className="spinner" role="status" aria-label="Wczytywanie kodu QR" />
          )}
        </div>
        <div className={styles.downloads}>
          {(['png', 'svg'] as const).map((format) => (
            <button
              key={format}
              type="button"
              className={`btn btn-secondary btn-sm${downloading === format ? ' is-loading' : ''}`}
              aria-disabled={downloading !== null}
              onClick={() => void download(format)}
            >
              <Download className="i sm" aria-hidden="true" />
              Pobierz {format.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="hint">PNG 1024 × 1024 px do dokumentów, SVG do druku w dowolnym rozmiarze</p>
        {downloadFailed && (
          <p className="hint is-error" role="alert">
            Nie udało się pobrać pliku. Spróbuj ponownie
          </p>
        )}
      </section>

      {/* Always rendered, so screen readers announce the message when it appears. */}
      <div role="status" aria-live="polite">
        {copied && (
          <div className="toast">
            <Check className="i sm" aria-hidden="true" />
            Skopiowano link
          </div>
        )}
      </div>
    </div>
  );
}
