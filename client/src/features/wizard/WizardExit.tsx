'use client';

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

type Leave = (href: string) => void;
type Guard = () => Promise<boolean>;
type Registry = {
  set: (leave: Leave | null, guard?: Guard | null) => void;
  get: () => Leave | null;
  getGuard: () => Guard | null;
};

const WizardExitContext = createContext<Registry | null>(null);

/** Lets a step take over the wizard's top-bar links (e.g. save pending changes first). */
export function WizardExitProvider({ children }: { children: ReactNode }) {
  const handler = useRef<Leave | null>(null);
  const guard = useRef<Guard | null>(null);
  const registry = useMemo<Registry>(
    () => ({
      set: (leave, nextGuard) => {
        handler.current = leave;
        guard.current = nextGuard ?? null;
      },
      get: () => handler.current,
      getGuard: () => guard.current,
    }),
    [],
  );
  return <WizardExitContext.Provider value={registry}>{children}</WizardExitContext.Provider>;
}

export function useWizardExitHandler(): Registry | null {
  return useContext(WizardExitContext);
}

/** Register how the current step leaves; removed when the step unmounts. */
export function useWizardExit(leave: Leave | null, guard?: Guard) {
  const registry = useContext(WizardExitContext);
  useEffect(() => {
    if (!registry || !leave) return;
    registry.set(leave, guard);
    return () => {
      if (registry.get() === leave) registry.set(null);
    };
  }, [registry, leave, guard]);
}
