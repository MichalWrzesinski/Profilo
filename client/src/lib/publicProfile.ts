import { cache } from 'react';
import type { components } from './api/schema';

export type PublicProfile = components['schemas']['PublicProfile'];

/** Operator address for abuse reports (PUB-BR-10). Placeholder until the operator is known. */
export const ABUSE_EMAIL = 'naduzycia@profilo.pl';

function apiBase(): string {
  return process.env.API_INTERNAL_URL ?? 'http://localhost:8000';
}

/**
 * Published snapshot for the public page, read on the server (PUB-BR-8). Returns null for
 * every hidden page (PUB-BR-6). Never cached: unpublishing must work on the next request.
 * Wrapped in `cache` so the page and its metadata share one request.
 */
export const getPublicProfile = cache(async (nick: string): Promise<PublicProfile | null> => {
  const response = await fetch(`${apiBase()}/api/v1/public/profiles/${encodeURIComponent(nick)}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public profile request failed: ${response.status}`);
  return (await response.json()) as PublicProfile;
});

/** "AW" for "Anna Wiśniewska", "K" for "Kasia" — the avatar fallback (PRF-BR-8). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = (word: string | undefined) => (word ? Array.from(word)[0]! : '');
  const letters = words.length > 1 ? first(words[0]) + first(words.at(-1)) : first(words[0]);
  return letters.toLocaleUpperCase('pl-PL');
}
