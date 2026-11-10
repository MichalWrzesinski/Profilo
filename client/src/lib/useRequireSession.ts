'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from './session';

/** Restore the session and send anonymous visitors to the login page. */
export function useRequireSession() {
  const router = useRouter();
  const session = useSession();
  const { ensure, status } = session;

  useEffect(() => {
    void ensure();
  }, [ensure]);

  useEffect(() => {
    if (status === 'anonymous') router.replace('/logowanie');
  }, [status, router]);

  return session;
}
