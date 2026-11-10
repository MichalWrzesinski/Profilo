import type { ReactNode } from 'react';
import { Brand } from './Brand';
import styles from './AuthCard.module.css';

type Props = { title: string; lead?: string; topbarAction?: ReactNode; children: ReactNode };

export function AuthCard({ title, lead, topbarAction, children }: Props) {
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
      </main>
    </>
  );
}
