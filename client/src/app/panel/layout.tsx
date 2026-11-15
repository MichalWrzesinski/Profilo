import type { Metadata } from 'next';
import { PRIVATE_PAGE } from '@/lib/site';

// The shell is a client component (session guard); metadata needs a server module.
export const metadata: Metadata = PRIVATE_PAGE;
export { default } from './Shell';
