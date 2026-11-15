import { PreviewFrame } from '@/features/preview/PreviewFrame';
import { abuseEmail } from '@/lib/operator';

// ABUSE_EMAIL is read per request, so the preview footer is the public page's exactly.
export const dynamic = 'force-dynamic';

export default function PreviewPage() {
  return <PreviewFrame abuseEmail={abuseEmail()} />;
}
