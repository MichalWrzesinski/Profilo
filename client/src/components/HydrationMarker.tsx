'use client';

import { useEffect } from 'react';

/** Marks the page as interactive (`<html data-hydrated>`); E2E tests wait for it. */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return null;
}
