'use client';

import { useEffect, useState } from 'react';
import { authorizedFetch } from '@/lib/api/client';

type Props = { url: string; alt: string; className?: string };

/**
 * An image of the owner's draft. Draft images are served only with the access token, which
 * an `<img src>` cannot send, so the image is fetched and shown from a blob URL.
 */
export function OwnerImage({ url, alt, className }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    authorizedFetch(url)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob || !active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  // eslint-disable-next-line @next/next/no-img-element -- blob URL, not optimisable
  return src ? <img src={src} alt={alt} className={className} /> : null;
}
