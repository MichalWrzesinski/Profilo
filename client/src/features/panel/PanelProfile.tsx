'use client';

import { ExternalLink } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type OwnerProfile = components['schemas']['OwnerProfile'];

type Value = {
  profile: OwnerProfile | null;
  loadFailed: boolean;
  setProfile: (profile: OwnerProfile) => void;
};

const PanelProfileContext = createContext<Value | null>(null);

/**
 * The owner's profile for the whole panel, loaded once: the publish panel changes it and the
 * top bar's „Zobacz swój profil” follows (published or not).
 */
export function PanelProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    api
      .GET('/api/v1/me/profile')
      .then(({ data }) => (data ? setProfile(data) : setLoadFailed(true)))
      .catch(() => setLoadFailed(true));
  }, []);

  return (
    <PanelProfileContext.Provider value={{ profile, loadFailed, setProfile }}>
      {children}
    </PanelProfileContext.Provider>
  );
}

export function usePanelProfile(): Value {
  const value = useOptionalPanelProfile();
  if (!value) throw new Error('usePanelProfile must be used inside <PanelProfileProvider>');
  return value;
}

export function useOptionalPanelProfile(): Value | null {
  return useContext(PanelProfileContext);
}

/** Opens the published page in a new tab; nothing before the first publication. */
export function ViewProfileLink({ profile: supplied }: { profile?: OwnerProfile | null } = {}) {
  const context = useOptionalPanelProfile();
  const profile = supplied === undefined ? context?.profile : supplied;
  if (profile?.status !== 'published' || !profile.publicUrl) return null;
  return (
    <a
      className="btn btn-secondary btn-sm"
      href={profile.publicUrl}
      target="_blank"
      rel="noopener"
      aria-label="Zobacz swój profil (otwiera się w nowej karcie)"
    >
      <ExternalLink className="i sm" aria-hidden="true" />
      <span className="hide-m">Zobacz swój profil</span>
    </a>
  );
}
