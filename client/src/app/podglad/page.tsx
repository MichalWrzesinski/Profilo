'use client';

import { useEffect, useState } from 'react';
import { isPreviewMessage } from '@/features/preview/draftToPublic';
import { PublicPage } from '@/features/public/PublicPage';
import type { PublicProfile } from '@/lib/publicProfile';

/**
 * The draft rendered by the same component as /user/{nick}, inside the editor's frame.
 * Content comes from the parent window (same origin only); links do not navigate.
 */
export default function PreviewPage() {
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (isPreviewMessage(event.data)) setProfile(event.data.profile);
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest('a')) event.preventDefault();
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('click', onClick, true);
    window.parent.postMessage({ type: 'profilo-preview-ready' }, window.location.origin);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  if (!profile) {
    return (
      <p className="muted" role="status" style={{ padding: 'var(--space-8)' }}>
        Wczytywanie podglądu…
      </p>
    );
  }
  return <PublicPage profile={profile} />;
}
