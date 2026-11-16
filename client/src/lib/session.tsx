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
import { clearDrafts } from './draftStorage';

type Status = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Set in this browser while someone is signed in, so that public pages restore the session
 * only when there may be one (the refresh cookie is HttpOnly and cannot be checked).
 */
const SIGNED_IN_HINT = 'profilo:signed-in';

function readHint(): boolean {
  try {
    return window.localStorage.getItem(SIGNED_IN_HINT) === '1';
  } catch {
    return true; // Storage blocked: ask the API instead.
  }
}

function writeHint(signedIn: boolean): void {
  try {
    if (signedIn) window.localStorage.setItem(SIGNED_IN_HINT, '1');
    else window.localStorage.removeItem(SIGNED_IN_HINT);
  } catch {
    // Storage blocked: public pages ask the API every time.
  }
}

type SessionContextValue = {
  status: Status;
  account: Account | null;
  /** Restore the session from the refresh cookie when it is not known yet. */
  ensure: () => Promise<void>;
  /** Like `ensure`, but only when this browser was signed in (public pages). */
  resume: () => Promise<void>;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
  markEmailConfirmed: () => void;
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
      tokenStore.set(session.accessToken, session.expiresIn);
      setAccount(session.account);
      setStatus('authenticated');
      writeHint(true);
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
      writeHint(false);
    }
  }, [signIn, setStatus]);

  // Without the hint the status stays unknown, so a private page still asks the API.
  const resume = useCallback(async () => {
    if (readHint()) await ensure();
  }, [ensure]);

  const signOut = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      clearDrafts();
      writeHint(false);
      setAccount(null);
      setStatus('anonymous');
    }
  }, [setStatus]);

  const markEmailConfirmed = useCallback(() => {
    setAccount((current) => (current ? { ...current, emailConfirmed: true } : current));
  }, []);

  const value = useMemo(
    () => ({ status, account, ensure, resume, signIn, signOut, markEmailConfirmed }),
    [status, account, ensure, resume, signIn, signOut, markEmailConfirmed],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
