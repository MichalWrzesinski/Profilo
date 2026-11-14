import type { Metadata } from 'next';
import { PreviewStep } from '@/features/wizard/PreviewStep';

export const metadata: Metadata = { title: 'Kreator: podgląd — Profilo' };

export default function WizardPreviewPage() {
  return <PreviewStep />;
}
