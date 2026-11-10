import type { Metadata } from 'next';
import { Editor } from '@/features/editor/Editor';

export const metadata: Metadata = { title: 'Edycja strony — Profilo' };

export default function EditorPage() {
  return <Editor />;
}
