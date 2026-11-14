import { DRAFT_KEYS, patchValue, type OwnerProfile, type Values } from '@/features/editor/fields';
import type { PublicProfile } from '@/lib/publicProfile';

/**
 * The draft as the public page would show it, including changes typed but not saved yet,
 * so the preview follows the form at once (TASK-011 scenario 1).
 */
export function draftToPublic(profile: OwnerProfile, values?: Values): PublicProfile {
  const content = { ...profile.draft };
  if (values) {
    for (const key of DRAFT_KEYS) {
      const value = patchValue(values, key);
      (content as Record<string, unknown>)[key] =
        key === 'displayName' ? value || content.displayName : value;
    }
  }
  return {
    nick: profile.nick ?? 'twoj-adres',
    canonicalUrl: profile.publicUrl ?? '',
    publishedAt: profile.publishedAt ?? new Date(0).toISOString(),
    content,
  };
}

/** Message the editor sends to the preview frame. */
export type PreviewMessage = { type: 'profilo-preview'; profile: PublicProfile };

export function isPreviewMessage(data: unknown): data is PreviewMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'profilo-preview' &&
    typeof (data as { profile?: unknown }).profile === 'object'
  );
}
