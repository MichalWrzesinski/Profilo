'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/features/landing/SiteFooter';
import styles from './ServiceFrame.module.css';

/** Public cards and embedded previews keep their own layout and footer. */
export function ServiceFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path.startsWith('/user/') || path === '/przyklad' || path === '/podglad') return children;
  return (
    <div className={styles.frame} data-wizard={path.startsWith('/kreator') || undefined}>
      <div className={styles.content}>{children}</div>
      <SiteFooter />
    </div>
  );
}
