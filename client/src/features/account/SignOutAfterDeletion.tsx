'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/session';

const FLAG = 'profilo:account-deleted';

/** Set right before going to the goodbye page after a successful deletion. */
export function markDeleted(): void {
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch {
    // Storage blocked: the page then only redirects; the server has revoked everything.
  }
}

function takeFlag(): boolean {
  try {
    const set = sessionStorage.getItem(FLAG) === '1';
    sessionStorage.removeItem(FLAG);
    return set;
  } catch {
    return false;
  }
}

/** After a deletion: end the local session (token in memory, refresh cookie, drafts kept in
 * this browser). Opened any other way (a link, a bookmark) it signs nobody out and goes home. */
export function SignOutAfterDeletion() {
  const router = useRouter();
  const { signOut } = useSession();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // once: React strict mode runs effects twice
    started.current = true;
    if (takeFlag()) void signOut();
    else router.replace('/');
  }, [signOut, router]);
  return null;
}
