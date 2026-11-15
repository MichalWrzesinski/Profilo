'use client';

import { ArrowUpRight, Check, Copy, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { authorizedFetch } from '@/lib/api/client';
import styles from './SharePanel.module.css';

type Format = 'png' | 'svg';
type Props = { publicUrl: string; nick: string };

const TOAST_MS = 3000;
const qrUrl = (format: Format) => `${window.location.origin}/api/v1/me/profile/qr?format=${format}`;

/** Address without the scheme, as people write it on a card: `profilo.pl/user/anna`. */
export function shortAddress(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

/** QR preview from the API (needs the access token, so it is shown from a blob URL). */
function useQrPreview() {
  const [state, setState] = useState<{ src: string | null; failed: boolean }>({
    src: null,
    failed: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    authorizedFetch(qrUrl('svg'))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ src: objectUrl, failed: false });
      })
      .catch(() => {
        if (active) setState({ src: null, failed: true });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt]);

  const retry = () => {
    setState({ src: null, failed: false });
    setAttempt((value) => value + 1);
  };
  return { ...state, retry };
}

/**
 * The page address with „Kopiuj link” and „Otwórz stronę”, and the QR code to download as
 * PNG or SVG (PUB-BR-12). Used on the „Opublikowano” screen and in the editor's share dialog.
 */
export function SharePanel({ publicUrl, nick }: Props) {
  const address = shortAddress(publicUrl);
  const qr = useQrPreview();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [downloading, setDownloading] = useState<Format | null>(null);
  const [downloadFailed, setDownloadFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      // No Clipboard API access (an older browser or a denied permission): select the full
      // address and try the legacy copy command; otherwise the owner copies it with Ctrl+C.
      const field = input.current;
      if (field) {
        field.value = publicUrl;
        field.select();
      }
      const legacy = typeof document.execCommand === 'function' && document.execCommand('copy');
      if (field) field.value = address;
      if (legacy) {
        setCopyFailed(false);
        setCopied(true);
      } else {
        field?.select();
        setCopyFailed(true);
      }
    }
  };

  const download = async (format: Format) => {
    setDownloading(format);
    setDownloadFailed(false);
    try {
      const response = await authorizedFetch(qrUrl(format));
      if (!response.ok) throw new Error(String(response.status));
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `profilo-${nick}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      // Revoked later: some browsers start the download only after the click returns.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    } catch {
      setDownloadFailed(true);
    } finally {
      setDownloading(null);
    }
  };

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
          Nie udało się skopiować. Adres jest zaznaczony — skopiuj go skrótem Ctrl+C (⌘C).
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
        <div className={styles.code}>
          {qr.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL, not optimisable
            <img src={qr.src} alt={`Kod QR z adresem ${address}`} width={148} height={148} />
          ) : qr.failed ? (
            <p className="hint">
              Nie udało się wczytać kodu.{' '}
              <button type="button" className="btn btn-ghost btn-sm" onClick={qr.retry}>
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
              disabled={downloading !== null}
              onClick={() => void download(format)}
            >
              <Download className="i sm" aria-hidden="true" />
              Pobierz {format.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="hint">PNG 1024 × 1024 px do dokumentów, SVG do druku w dowolnym rozmiarze.</p>
        {downloadFailed && (
          <p className="hint is-error" role="alert">
            Nie udało się pobrać pliku. Spróbuj ponownie.
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
