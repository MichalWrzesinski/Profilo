'use client';

import { ChecklistCard, firstName, ShareCard, Shortcuts } from '@/features/panel/PanelCards';
import { usePanelProfile } from '@/features/panel/PanelProfile';
import { PublishPanel } from '@/features/panel/PublishPanel';
import styles from './page.module.css';

export default function PanelPage() {
  const { profile } = usePanelProfile();
  const name = firstName(profile);
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{name ? `Cześć, ${name}` : 'Twoja strona'}</h1>
      <p className={`muted ${styles.lead}`}>
        Tu sprawdzisz, jak wygląda Twoja strona, dokończysz ją i udostępnisz swój adres
      </p>
      <div className={styles.top}>
        <PublishPanel />
        <ShareCard />
      </div>
      <ChecklistCard />
      <Shortcuts />
    </main>
  );
}
