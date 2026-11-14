'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Problem } from '@/lib/api/client';
import { readDraft, writeDraft } from '@/lib/draftStorage';
import {
  DRAFT_KEYS,
  draftKeyOf,
  patchValue,
  validate,
  valuesFrom,
  type DraftKey,
  type OwnerProfile,
  type Values,
} from './fields';

/** PRF-BR-14: save within 1 second of the last edit. */
export const AUTOSAVE_DELAY_MS = 1000;

export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict';
type Errors = Partial<Record<DraftKey, string>>;
type Stored = { baseVersion: number; values: Values; dirty: DraftKey[] };

/** Field of a validation error: `publicPhone` or `body.publicPhone` → `publicPhone`. */
function errorKey(field: string): DraftKey | null {
  const key = field.split('.').at(-1) as DraftKey;
  return DRAFT_KEYS.includes(key) ? key : null;
}

/**
 * Draft autosave with optimistic locking (PRF-BR-14). Only changed fields are sent; a field
 * with an error is held back until it is corrected, so the draft keeps its last valid value.
 */
export function useAutosave(initial: OwnerProfile, storageKey: string) {
  // Changes left in this browser by a failed save of the same draft version come back.
  const [restored] = useState(() => {
    const stored = readDraft<Stored>(storageKey);
    if (stored && stored.baseVersion === initial.version) return stored;
    if (stored) writeDraft(storageKey, null);
    return null;
  });
  const [profile, setProfile] = useState(initial);
  const [values, setValues] = useState<Values>(() => restored?.values ?? valuesFrom(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [conflict, setConflict] = useState<OwnerProfile | null>(null);
  const [pending, setPending] = useState(restored !== null);
  const [busy, setBusy] = useState(false);

  // Latest state for the timer and request callbacks; updated together with the state.
  const live = useRef({ profile, values, errors });
  const dirty = useRef(new Set<DraftKey>(restored?.dirty));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const stopped = useRef(false);
  // The last save failed (network, server or an error we cannot show at a field).
  const failed = useRef(false);
  // A link change is running: autosave waits so the two never send the same version.
  const locked = useRef(false);
  // `flush` sends follow-up saves through this ref (a callback cannot name itself).
  const again = useRef<() => Promise<void>>(async () => {});

  const remember = useCallback(() => {
    const { profile: current, values: now } = live.current;
    writeDraft(
      storageKey,
      dirty.current.size
        ? { baseVersion: current.version, values: now, dirty: [...dirty.current] }
        : null,
    );
    setPending(dirty.current.size > 0);
  }, [storageKey]);

  const send = useCallback(
    async (body: Record<string, unknown>, keys: DraftKey[], keepalive: boolean) => {
      const request = () =>
        api.PATCH('/api/v1/me/profile', { body: body as { version: number }, keepalive });
      let result: Awaited<ReturnType<typeof request>>;
      try {
        result = await request();
      } catch {
        inFlight.current = null;
        failed.current = true;
        return setStatus('error');
      }
      failed.current = false;
      // This request is over; follow-up saves below may start the next one.
      inFlight.current = null;
      const { data, error, response } = result;
      const unchanged = (key: DraftKey) => patchValue(live.current.values, key) === body[key];

      if (data) {
        live.current.profile = data;
        setProfile(data);
        // Edited again while saving: keep it dirty, the next save sends the new value.
        keys.filter(unchanged).forEach((key) => dirty.current.delete(key));
        remember();
        setStatus('saved');
        if ([...dirty.current].some((key) => !live.current.errors[key])) void again.current();
        return;
      }
      const problem = error as (Problem & { current?: OwnerProfile }) | undefined;
      if (response.status === 409 && problem?.code === 'draft_conflict') {
        stopped.current = true;
        setConflict(problem.current ?? null);
        return setStatus('conflict');
      }
      const rejected = (problem?.errors ?? [])
        .map((item) => ({ key: errorKey(item.field), message: item.message }))
        .filter((item): item is { key: DraftKey; message: string } => item.key !== null);
      if (response.status === 422 && rejected.length > 0) {
        const next: Errors = { ...live.current.errors };
        const sent = rejected.filter((item) => keys.includes(item.key));
        // An error for a field not in this request would make us resend the same body.
        if (sent.length === 0) {
          failed.current = true;
          return setStatus('error');
        }
        // A field edited while the request was in flight gets checked again with its new value.
        for (const item of sent) if (unchanged(item.key)) next[item.key] = item.message;
        live.current.errors = next;
        setErrors(next);
        setStatus('saved');
        // The other fields of this request were not saved either: send them again.
        return again.current();
      }
      // Other errors (also a 422 we cannot attach to a field): stop and offer a retry.
      failed.current = true;
      setStatus('error');
    },
    [remember],
  );

  const flush = useCallback(
    (options: { keepalive?: boolean } = {}): Promise<void> => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (inFlight.current || stopped.current) return inFlight.current ?? Promise.resolve();
      if (locked.current) return Promise.resolve(); // sent when the link change ends
      const { profile: base, values: snapshot, errors: known } = live.current;
      const keys = [...dirty.current].filter((key) => !known[key]);
      if (keys.length === 0) return Promise.resolve();
      const body: Record<string, unknown> = { version: base.version };
      for (const key of keys) body[key] = patchValue(snapshot, key);
      setStatus('saving');
      const run: Promise<void> = send(body, keys, options.keepalive ?? false).finally(() => {
        // A follow-up save may already be in flight: clear only this request.
        if (inFlight.current === run) inFlight.current = null;
      });
      inFlight.current = run;
      return run;
    },
    [send],
  );

  useEffect(() => {
    again.current = flush;
  }, [flush]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }, [flush]);

  const savable = () => [...dirty.current].some((key) => !live.current.errors[key]);

  /** Save everything that can be saved now; true when nothing is left unsaved. */
  const settle = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 5 && !stopped.current; attempt += 1) {
      if (inFlight.current) await inFlight.current;
      if (!savable()) break;
      await flush();
      if (failed.current) break; // offline: one attempt, then let the owner decide
    }
    return dirty.current.size === 0 && !stopped.current;
  }, [flush]);

  /**
   * Run a change that bumps the draft version on its own (links). Changes run one after
   * another; before each, pending field changes are saved; while it runs autosave waits.
   * A profile older than the one already known is ignored.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const queued = useRef(0);
  const exclusive = useCallback(
    (change: () => Promise<OwnerProfile | null>): Promise<void> => {
      queued.current += 1;
      setBusy(true);
      const run = queue.current.then(async () => {
        await settle();
        locked.current = true;
        try {
          const next = await change();
          if (next && next.version >= live.current.profile.version) {
            live.current.profile = next;
            setProfile(next);
          }
        } finally {
          locked.current = false;
          queued.current -= 1;
          if (queued.current === 0) {
            setBusy(false);
            if (savable()) schedule();
          }
        }
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [settle, schedule],
  );

  const edit = useCallback(
    (input: keyof Values, value: string) => {
      if (stopped.current) return;
      const key = draftKeyOf(input);
      const values = { ...live.current.values, [input]: value } as Values;
      const message = validate(values, key);
      const errors = { ...live.current.errors };
      if (message) errors[key] = message;
      else delete errors[key];
      live.current = { ...live.current, values, errors };
      setValues(values);
      setErrors(errors);
      dirty.current.add(key);
      remember();
      schedule();
    },
    [remember, schedule],
  );

  /** Take the newer draft from the other window and drop the local changes. */
  const reload = useCallback(() => {
    if (!conflict) return;
    dirty.current.clear();
    stopped.current = false;
    live.current = { profile: conflict, values: valuesFrom(conflict), errors: {} };
    setProfile(conflict);
    setValues(valuesFrom(conflict));
    setErrors({});
    setConflict(null);
    remember();
    setStatus('saved');
  }, [conflict, remember]);

  // Send restored changes once, right after mounting.
  useEffect(() => {
    if (!restored) return;
    const id = setTimeout(() => void flush(), 0);
    return () => clearTimeout(id);
  }, [restored, flush]);

  // Leaving the page with unsaved changes asks for confirmation.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current.size > 0) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      // Closing the editor during the delay: send the change now; `keepalive` lets the
      // request finish even when the whole page is being closed.
      if (timer.current) void flush({ keepalive: true });
    };
  }, [flush]);

  const invalid = Object.keys(errors).length > 0;
  return {
    profile,
    /**
     * Take the result of publishing. Publishing does not change the draft version; if the
     * draft was saved again meanwhile, keep the newer version and only take the status.
     */
    applyPublished: (published: OwnerProfile) => {
      const current = live.current.profile;
      const next =
        published.version === current.version
          ? published
          : {
              ...current,
              status: published.status,
              nickLocked: published.nickLocked,
              publishedAt: published.publishedAt,
              publicUrl: published.publicUrl,
              hasUnpublishedChanges: true,
            };
      live.current.profile = next;
      setProfile(next);
    },
    values,
    errors,
    status,
    /** What the top bar shows: waiting for the delay counts as saving. */
    shownStatus: pending && status === 'saved' && !invalid ? ('saving' as const) : status,
    /** True while some change is not on the server yet (typing, saving, failed or invalid). */
    unsaved: pending || busy || status !== 'saved' || invalid,
    invalid,
    edit,
    retry: () => void flush(),
    settle,
    exclusive,
    /** A link change is waiting or running. */
    busy,
    reload,
  };
}
