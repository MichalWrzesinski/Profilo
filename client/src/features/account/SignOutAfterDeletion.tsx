'use client';

import { useEffect } from 'react';
import { useSession } from '@/lib/session';

/** Ends the local session after the account was deleted: the token in memory, the refresh
 * cookie and the drafts kept in this browser. The server has revoked everything already. */
export function SignOutAfterDeletion() {
  const { signOut } = useSession();
  useEffect(() => {
    void signOut();
  }, [signOut]);
  return null;
}
