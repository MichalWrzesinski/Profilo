/**
 * Unsaved editor changes kept in this browser while saving fails (profile.md edge cases).
 * Keys are per account; all of them are removed at logout so the next person using the
 * browser cannot read them.
 */
const PREFIX = 'profilo:draft:';

export function draftStorageKey(accountId: string): string {
  return `${PREFIX}${accountId}`;
}

export function readDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode): the changes stay in memory only.
  }
}

export function clearDrafts(): void {
  try {
    const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(PREFIX));
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nothing stored or storage blocked.
  }
}
