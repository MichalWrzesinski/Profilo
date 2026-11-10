'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Problem } from '@/lib/api/client';
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

// Unsaved changes are kept in this browser while saving fails (profile.md edge cases).
function readStored(key: string): Stored | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: Stored | null): void {
  try {
    if (value) window.localStorage.setItem(key, JSON.stringify(value));
    else window.localStorage.removeItem(key);
  } catch {
    // Storage blocked (private mode): the changes stay in memory only.
  }
}

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
    const stored = readStored(storageKey);
    if (stored && stored.baseVersion === initial.version) return stored;
    if (stored) writeStored(storageKey, null);
    return null;
  });
  const [profile, setProfile] = useState(initial);
  const [values, setValues] = useState<Values>(() => restored?.values ?? valuesFrom(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [conflict, setConflict] = useState<OwnerProfile | null>(null);
  const [pending, setPending] = useState(restored !== null);

  // Latest state for the timer and request callbacks; updated together with the state.
  const live = useRef({ profile, values, errors });
  const dirty = useRef(new Set<DraftKey>(restored?.dirty));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const stopped = useRef(false);
  // `flush` sends follow-up saves through this ref (a callback cannot name itself).
  const again = useRef<() => Promise<void>>(async () => {});

  const remember = useCallback(() => {
    const { profile: current, values: now } = live.current;
    writeStored(
      storageKey,
      dirty.current.size
        ? { baseVersion: current.version, values: now, dirty: [...dirty.current] }
        : null,
    );
    setPending(dirty.current.size > 0);
  }, [storageKey]);

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current || stopped.current) return;
    const { profile: base, values: snapshot, errors: known } = live.current;
    const keys = [...dirty.current].filter((key) => !known[key]);
    if (keys.length === 0) return;
    const body: Record<string, unknown> = { version: base.version };
    for (const key of keys) body[key] = patchValue(snapshot, key);

    inFlight.current = true;
    setStatus('saving');
    const request = () => api.PATCH('/api/v1/me/profile', { body: body as { version: number } });
    let result: Awaited<ReturnType<typeof request>>;
    try {
      result = await request();
    } catch {
      inFlight.current = false;
      return setStatus('error');
    }
    inFlight.current = false;
    const { data, error, response } = result;

    if (data) {
      live.current.profile = data;
      setProfile(data);
      for (const key of keys) {
        // Edited again while saving: keep it dirty, the next save sends the new value.
        if (patchValue(live.current.values, key) === body[key]) dirty.current.delete(key);
      }
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
    if (response.status === 422 && problem?.errors?.length) {
      const next: Errors = { ...live.current.errors };
      for (const item of problem.errors) {
        const key = errorKey(item.field);
        if (key) next[key] = item.message;
      }
      live.current.errors = next;
      setErrors(next);
      setStatus('saved');
      // The other fields of this request were not saved either: send them again.
      return again.current();
    }
    setStatus('error');
  }, [remember]);

  useEffect(() => {
    again.current = flush;
  }, [flush]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }, [flush]);

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
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const invalid = Object.keys(errors).length > 0;
  return {
    profile,
    setProfile: (next: OwnerProfile) => {
      live.current.profile = next;
      setProfile(next);
    },
    values,
    errors,
    status,
    /** True while some change is not on the server yet (typing, saving, failed or invalid). */
    unsaved: pending || status !== 'saved' || invalid,
    invalid,
    edit,
    retry: () => void flush(),
    reload,
  };
}
