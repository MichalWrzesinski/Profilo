import type { ReactNode } from 'react';
import styles from './NickStep.module.css';

/** Bottom bar of a wizard step: back on the left, next on the right (mockup .wizbar). */
export function WizardBar({ children }: { children: ReactNode }) {
  return <div className={styles.bar}>{children}</div>;
}
