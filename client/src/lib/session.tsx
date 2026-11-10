'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  logoutSession,
  refreshSession,
  tokenStore,
  type Account,
  type Session,
} from './api/client';

type Status = 'unknown' | 'authenticated' | 'anonymous';

type SessionContextValue = {
  status: Status;
  account: Account | null;
  /** Restore the session from the refresh cookie when it is not known yet. */
  ensure: () => Promise<void>;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatusState] = useState<Status>('unknown');
  const [account, setAccount] = useState<Account | null>(null);
  // Read by `ensure` so that its identity stays stable (effects depending on it run once).
  const statusRef = useRef<Status>('unknown');
  const setStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const signIn = useCallback(
    (session: Session) => {
      tokenStore.set(session.accessToken);
      setAccount(session.account);
      setStatus('authenticated');
    },
    [setStatus],
  );

  const ensure = useCallback(async () => {
    if (statusRef.current !== 'unknown') return;
    const session = await refreshSession();
    if (session) {
      signIn(session);
    } else {
      setAccount(null);
      setStatus('anonymous');
    }
  }, [signIn, setStatus]);

  const signOut = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      setAccount(null);
      setStatus('anonymous');
    }
  }, [setStatus]);

  const value = useMemo(
    () => ({ status, account, ensure, signIn, signOut }),
    [status, account, ensure, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
