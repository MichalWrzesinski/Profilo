import type { ReactNode } from 'react';
import { Alert } from '@/components/Alert';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/features/landing/SiteFooter';
import { LEGAL_VERSION } from '@/lib/operator';
import styles from './LegalDocument.module.css';

type Props = { title: string; children: ReactNode };

/** Text of a legal page: header, version, demo notice and the sections. */
export function LegalDocument({ title, children }: Props) {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <article className={styles.doc}>
          <h1>{title}</h1>
          <p className="muted">{LEGAL_VERSION}</p>
          <Alert variant="warning">
            <b>Wersja demonstracyjna.</b> Ten serwis jest wersją demo oprogramowania Profilo. Konta,
            strony i wszystkie dane mogą zostać usunięte bez uprzedzenia podczas resetu lub
            czyszczenia platformy demonstracyjnej
          </Alert>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

/** A value the operator still has to provide, clearly marked (TASK-019 scenario 2). */
export function Placeholder({ value, label }: { value: string | null; label: string }) {
  if (value) return <>{value}</>;
  return (
    <mark className={styles.placeholder} title="Do uzupełnienia przed uruchomieniem">
      [do uzupełnienia: {label}]
    </mark>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}
