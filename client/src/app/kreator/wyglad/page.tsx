import type { Metadata } from 'next';
import { AppearanceStep } from '@/features/wizard/AppearanceStep';

export const metadata: Metadata = { title: 'Kreator: wygląd — Profilo' };

export default function WizardAppearancePage() {
  return <AppearanceStep />;
}
