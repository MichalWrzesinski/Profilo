import type { ReactNode } from 'react';
import { Brand } from './Brand';
import styles from './AuthCard.module.css';

type Props = {
  title: string;
  lead?: string;
  topbarAction?: ReactNode;
  /** Centred under the card, e.g. the link between login and registration. */
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthCard({ title, lead, topbarAction, footer, children }: Props) {
  return (
    <>
      <header className="topbar">
        <Brand />
        <span className="spacer" />
        {topbarAction}
      </header>
      <main className={styles.main}>
        <div className="card card-pad">
          <h1 className={styles.title}>{title}</h1>
          {lead && <p className={styles.lead}>{lead}</p>}
          {children}
        </div>
        {footer && <p className={styles.footer}>{footer}</p>}
      </main>
    </>
  );
}
