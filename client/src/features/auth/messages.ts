import type { Problem } from '@/lib/api/client';

export const GENERIC_ERROR = 'Coś poszło nie tak. Spróbuj ponownie za chwilę.';

/** Message for the form-level alert from an API problem response. */
export function problemMessage(problem: Problem | undefined): string {
  if (problem?.status === 429) {
    return problem.detail ?? 'Za dużo prób. Spróbuj ponownie później.';
  }
  return problem?.detail ?? GENERIC_ERROR;
}
