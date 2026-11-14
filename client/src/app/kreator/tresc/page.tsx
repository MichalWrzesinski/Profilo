import type { Metadata } from 'next';
import { Editor } from '@/features/editor/Editor';

export const metadata: Metadata = { title: 'Kreator: treść — Profilo' };

export default function WizardContentPage() {
  return <Editor variant="wizard" />;
}
