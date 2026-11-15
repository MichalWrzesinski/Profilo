import { Suspense } from 'react';
import { NickStep } from '@/features/wizard/NickStep';

export default function WizardNickPage() {
  // NickStep reads `?adres=` (useSearchParams needs a Suspense boundary to prerender).
  return (
    <Suspense>
      <NickStep />
    </Suspense>
  );
}
