'use client';

import { useEffect, useRef, useState } from 'react';
import { authorizedFetch } from '@/lib/api/client';
import type { PublicProfile } from '@/lib/publicProfile';
import styles from './LivePreview.module.css';

export type Device = 'desktop' | 'phone';
const WIDTH: Record<Device, number> = { desktop: 1280, phone: 390 };

type Props = { profile: PublicProfile; device: Device; label?: string };

/** Fetch draft images with the access token once; the frame gets blob URLs. */
function useImageUrls(profile: PublicProfile): PublicProfile | null {
  const cache = useRef(new Map<string, string>());
  const [resolved, setResolved] = useState<PublicProfile | null>(null);

  useEffect(() => {
    let active = true;
    const pick = { avatar: '512', background: '1600' } as const;
    const resolve = async () => {
      const content = { ...profile.content };
      for (const kind of ['avatar', 'background'] as const) {
        const image = content[kind];
        if (!image) continue;
        const url = image.urls[pick[kind]] ?? Object.values(image.urls)[0]!;
        let blob = cache.current.get(url);
        if (!blob) {
          try {
            const response = await authorizedFetch(url);
            if (!response.ok) throw new Error(String(response.status));
            blob = URL.createObjectURL(await response.blob());
            cache.current.set(url, blob);
          } catch {
            content[kind] = null; // shown like a page without the image
            continue;
          }
        }
        content[kind] = {
          ...image,
          urls: Object.fromEntries(Object.keys(image.urls).map((size) => [size, blob])),
        };
      }
      if (active) setResolved({ ...profile, content });
    };
    void resolve();
    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    const urls = cache.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
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
