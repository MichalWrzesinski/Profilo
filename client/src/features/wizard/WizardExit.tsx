'use client';

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

type Leave = (href: string) => void;
type Registry = { set: (leave: Leave | null) => void; get: () => Leave | null };

const WizardExitContext = createContext<Registry | null>(null);

/** Lets a step take over the wizard's top-bar links (e.g. save pending changes first). */
export function WizardExitProvider({ children }: { children: ReactNode }) {
  const handler = useRef<Leave | null>(null);
  const registry = useMemo<Registry>(
    () => ({
      set: (leave) => {
        handler.current = leave;
      },
      get: () => handler.current,
    }),
    [],
  );
  return <WizardExitContext.Provider value={registry}>{children}</WizardExitContext.Provider>;
}

export function useWizardExitHandler(): Registry | null {
  return useContext(WizardExitContext);
}

/** Register how the current step leaves; removed when the step unmounts. */
export function useWizardExit(leave: Leave | null) {
  const registry = useContext(WizardExitContext);
  useEffect(() => {
    if (!registry || !leave) return;
    registry.set(leave);
    return () => {
      if (registry.get() === leave) registry.set(null);
    };
  }, [registry, leave]);
}
