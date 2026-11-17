'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  PanelProfileProvider,
  useOptionalPanelProfile,
  ViewProfileLink,
  type OwnerProfile,
} from '@/features/panel/PanelProfile';
import { useSession } from '@/lib/session';
import { AccountMenu } from './AccountMenu';
import { Brand } from './Brand';
import styles from './AccountHeader.module.css';

type Props = {
  className?: string;
  profile?: OwnerProfile | null;
  saveState?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  beforeLeave?: () => Promise<boolean>;
  beforeSignOut?: () => Promise<boolean>;
};

/** The same owner navigation on every service page; the editor supplies its draft. */
export function AccountHeader(props: Props) {
  const context = useOptionalPanelProfile();
  if (!context && props.profile === undefined) {
    return (
      <PanelProfileProvider>
        <AccountHeader {...props} />
      </PanelProfileProvider>
    );
  }
  return (
    <Header {...props} profile={props.profile === undefined ? context?.profile : props.profile} />
  );
}

function Header({
  profile,
  saveState,
  actions,
  badge,
  beforeLeave,
  beforeSignOut,
  className,
}: Props) {
  const { account } = useSession();
  const router = useRouter();
  return (
    <header
      className={`topbar ${styles.bar}${actions || saveState ? ` ${styles.editor}` : ''}${className ? ` ${className}` : ''}`}
    >
      <div
        className={styles.identity}
        onClickCapture={(event) => {
          if (
            !beforeLeave ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.button !== 0
          )
            return;
          if (!(event.target as Element).closest('a')) return;
          event.preventDefault();
          void beforeLeave().then((leave) => {
            if (leave) router.push('/');
          });
        }}
      >
        <Brand nameOnPhones={false} />
      </div>
      {saveState}
      {actions && (
        <div className={styles.actions}>
          {actions}
          <ViewProfileLink profile={profile} />
        </div>
      )}
      <span className="spacer" />
      {badge}
      {!actions && !saveState && (
        <span className={`muted hide-m ${styles.account}`}>
          Zalogowano jako <b>{account?.email}</b>
        </span>
      )}
      {!actions && <ViewProfileLink profile={profile} />}
      <AccountMenu beforeLeave={beforeLeave} beforeSignOut={beforeSignOut} />
    </header>
  );
}
