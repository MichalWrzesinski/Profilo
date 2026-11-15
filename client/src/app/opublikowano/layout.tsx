import type { Metadata } from 'next';
import { PRIVATE_PAGE } from '@/lib/site';

export const metadata: Metadata = { ...PRIVATE_PAGE, title: 'Strona opublikowana — Profilo' };
export { default } from '../edytor/Shell'; // the same session guard as the editor
