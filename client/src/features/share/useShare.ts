'use client';

import { useEffect, useRef, useState } from 'react';
import { authorizedFetch } from '@/lib/api/client';

export type QrFormat = 'png' | 'svg';

const TOAST_MS = 3000;
const qrUrl = (format: QrFormat) =>
  `${window.location.origin}/api/v1/me/profile/qr?format=${format}`;

/** Address without the scheme, as people write it on a card: `profilo.pl/user/anna`. */
export function shortAddress(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

/** QR preview from the API (needs the access token, so it is shown from a blob URL). */
export function useQrPreview() {
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
 * „Kopiuj link” with a toast, and a fallback that selects the address in the field given the
 * returned `input` ref.
 */
export function useCopyLink(publicUrl: string) {
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  /** Show the toast; a repeated copy shows it again, so screen readers announce it again. */
  const confirmCopied = () => {
    setCopyFailed(false);
    setCopied(false);
    requestAnimationFrame(() => setCopied(true));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      confirmCopied();
    } catch {
      // No Clipboard API access (an older browser or a denied permission): select the full
      // address and try the legacy copy command; otherwise the owner copies it with Ctrl+C.
      const field = input.current;
      const shown = field?.value;
      if (field) {
        field.value = publicUrl;
        field.select();
      }
      const legacy = typeof document.execCommand === 'function' && document.execCommand('copy');
      if (field && shown !== undefined) field.value = shown;
      if (legacy) confirmCopied();
      else {
        field?.select();
        setCopyFailed(true);
      }
    }
  };
  return { input, copied, copyFailed, copy };
}

/** Downloads the QR code as `profilo-<nick>.<format>`. */
export function useQrDownload(nick: string) {
  const [downloading, setDownloading] = useState<QrFormat | null>(null);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const busy = useRef(false);

  const download = async (format: QrFormat) => {
    if (busy.current) return; // aria-disabled, not disabled: the button keeps the focus
    busy.current = true;
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
      busy.current = false;
      setDownloading(null);
    }
  };
  return { downloading, downloadFailed, download };
}
