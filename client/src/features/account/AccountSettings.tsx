'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import styles from './AccountSettings.module.css';
import { ChangePasswordForm } from './ChangePasswordForm';
import { DeleteAccount } from './DeleteAccount';

/** „Ustawienia konta” in the panel (ACC-US-5, ACC-US-6). */
export function AccountSettings() {
  const { account } = useSession();
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  useEffect(() => {
    // Only for the address in the deletion dialog; without it the dialog still works.
    api
      .GET('/api/v1/me/profile')
      .then(({ data }) => setPublicUrl(data?.publicUrl ?? null))
      .catch(() => undefined);
  }, []);

  return (
    <main className={styles.page}>
      <h1>Ustawienia konta</h1>
      <p className="muted">
        E-mail do logowania: <b>{account?.email}</b>
      </p>
      <ChangePasswordForm />
      <DeleteAccount publicUrl={publicUrl} />
    </main>
  );
}
