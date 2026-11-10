import type { Metadata } from 'next';
import { NotFoundPage } from '@/components/NotFoundPage';

export const metadata: Metadata = { title: 'Nie znaleźliśmy tej strony — Profilo' };

export default function NotFound() {
  return <NotFoundPage />;
}
