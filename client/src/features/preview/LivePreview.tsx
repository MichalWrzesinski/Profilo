'use client';

import { useEffect, useRef, useState } from 'react';
import { authorizedFetch } from '@/lib/api/client';
import type { PublicProfile } from '@/lib/publicProfile';
import styles from './LivePreview.module.css';

export type Device = 'desktop' | 'phone';
const WIDTH: Record<Device, number> = { desktop: 1280, phone: 390 };

type Props = { profile: PublicProfile; device: Device; label?: string };

/**
 * Fetch draft images with the access token once per URL; the frame gets blob URLs. Each URL
 * is fetched once even while several updates wait for it; blobs of images that are no
 * longer in the draft, and all blobs on unmount, are revoked.
 */
function useImageUrls(profile: PublicProfile): PublicProfile | null {
  const blobs = useRef(new Map<string, Promise<string | null>>());
  const [resolved, setResolved] = useState<PublicProfile | null>(null);

  useEffect(() => {
    let active = true;
    const pick = { avatar: '512', background: '1600' } as const;
    const wanted = new Set<string>();
    const blobFor = (url: string) => {
      let pending = blobs.current.get(url);
      if (!pending) {
        pending = authorizedFetch(url)
          .then(async (response) => {
            if (!response.ok) throw new Error(String(response.status));
            return URL.createObjectURL(await response.blob());
          })
          .catch(() => {
            blobs.current.delete(url); // try again on the next update
            return null;
          });
        blobs.current.set(url, pending);
      }
      return pending;
    };
    const resolve = async () => {
      const content = { ...profile.content };
      for (const kind of ['avatar', 'background'] as const) {
        const image = content[kind];
        if (!image) continue;
        const url = image.urls[pick[kind]] ?? Object.values(image.urls)[0]!;
        wanted.add(url);
        const blob = await blobFor(url);
        // Without its image the page looks like one that has none.
        content[kind] = blob
          ? { ...image, urls: Object.fromEntries(Object.keys(image.urls).map((s) => [s, blob])) }
          : null;
      }
      if (!active) return;
      setResolved({ ...profile, content });
      for (const [url, pending] of blobs.current) {
        if (wanted.has(url)) continue;
        blobs.current.delete(url);
        void pending.then((blob) => blob && URL.revokeObjectURL(blob));
      }
    };
    void resolve();
    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    const all = blobs.current;
    return () => {
      for (const pending of all.values())
        void pending.then((blob) => blob && URL.revokeObjectURL(blob));
      all.clear();
    };
  }, []);

  return resolved;
}

/**
 * The draft as visitors will see it: the public page (/podglad) in a frame of desktop or
 * phone width, scaled to fit. Same component as /user/{nick}, so it matches exactly.
 */
export function LivePreview({ profile, device, label = 'Podgląd strony' }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const send = (profile: PublicProfile) =>
    frame.current?.contentWindow?.postMessage(
      { type: 'profilo-preview', profile },
      window.location.origin,
    );
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });
  const content = useImageUrls(profile);

  // The latest content, for a frame that reports it is ready (also after reloading).
  const latest = useRef(content);
  useEffect(() => {
    latest.current = content;
  }, [content]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === frame.current?.contentWindow &&
        (event.data as { type?: string } | null)?.type === 'profilo-preview-ready'
      ) {
        setReady(true);
        if (latest.current) send(latest.current);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (ready && content) send(content);
  }, [ready, content]);

  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBoxSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const width = WIDTH[device];
  const scale = boxSize.width ? Math.min(1, boxSize.width / width) : 1;
  return (
    <div ref={box} className={`${styles.box} ${device === 'phone' ? styles.phone : ''}`}>
      <iframe
        ref={frame}
        src="/podglad"
        title={label}
        tabIndex={-1}
        className={styles.frame}
        style={{
          width,
          height: boxSize.height ? boxSize.height / scale : 900,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}

/** Komputer / Telefon toggle from the mockup. */
export function DeviceToggle({
  device,
  onChange,
}: {
  device: Device;
  onChange: (d: Device) => void;
}) {
  return (
    <div className="seg" role="group" aria-label="Rozmiar podglądu">
      {(['desktop', 'phone'] as const).map((name) => (
        <button
          key={name}
          type="button"
          aria-pressed={device === name}
          onClick={() => onChange(name)}
        >
          {name === 'desktop' ? 'Komputer' : 'Telefon'}
        </button>
      ))}
    </div>
  );
}
