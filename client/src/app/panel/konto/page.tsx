import type { Metadata } from 'next';
import { AccountSettings } from '@/features/account/AccountSettings';

export const metadata: Metadata = { title: 'Ustawienia konta — Profilo' };

export default function AccountSettingsPage() {
  return <AccountSettings />;
}
