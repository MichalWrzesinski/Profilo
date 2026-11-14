'use client';

import { Check as CheckIcon, CircleAlert, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/Alert';
import { api, type Problem } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { NICK_RULE, nickFormatError, normaliseNickInput } from '@/lib/nick';
import styles from './NickStep.module.css';

type OwnerProfile = components['schemas']['OwnerProfile'];
type Check =
  | { state: 'idle' | 'checking' | 'available' | 'current' | 'invalid' | 'unknown' }
  | { state: 'taken'; suggestions: string[] };

const DEBOUNCE_MS = 300;

export function NickStep() {
  const router = useRouter();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [name, setName] = useState('');
  const [nick, setNick] = useState('');
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const nickTouched = useRef(false);
  // Every request gets a number; a response is applied only if no newer request started,
  // so a late answer for an older value never overwrites the state of the current one.
  const suggestionSeq = useRef(0);
  const checkSeq = useRef(0);
  const host = typeof window === 'undefined' ? 'profilo.pl' : window.location.host;

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    api
      .GET('/api/v1/me/profile')
      .then(({ data }) => {
        if (!data) return setLoadFailed(true);
        setProfile(data);
        setName(data.draft.displayName);
        if (data.nick) {
          nickTouched.current = true;
          setNick(data.nick);
          setCheck({ state: 'current' });
        }
      })
      .catch(() => setLoadFailed(true));
  }, [attempt]);

  // Propose a nick from the name until the owner edits the nick field (PRF-BR-2).
  useEffect(() => {
    if (!profile || nickTouched.current || !name.trim()) return;
    const seq = ++suggestionSeq.current;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.GET('/api/v1/nicks/suggestion', {
          params: { query: { displayName: name } },
        });
        if (seq !== suggestionSeq.current || nickTouched.current || !data) return;
        setNick(data.nick ?? '');
        setCheck({ state: data.nick ? 'available' : 'idle' });
      } catch {
        // No proposal: the owner types the nick.
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [name, profile]);

  const runCheck = (value: string) => {
    checkSeq.current++;
    if (nickFormatError(value)) return setCheck({ state: 'invalid' });
    if (value === profile?.nick) return setCheck({ state: 'current' });
    setCheck({ state: 'checking' });
  };

  // Live availability (PRF-BR-3), debounced. Saving runs the authoritative check, so when
  // the live check fails the owner may still continue.
  useEffect(() => {
    if (check.state !== 'checking') return;
    const seq = ++checkSeq.current;
    const timer = setTimeout(async () => {
      let result: Check = { state: 'unknown' };
      try {
        const { data } = await api.GET('/api/v1/nicks/{nick}/availability', {
          params: { path: { nick } },
        });
        if (data?.available) result = { state: 'available' };
        else if (data?.reason === 'invalid_format') result = { state: 'invalid' };
        else if (data) result = { state: 'taken', suggestions: data.suggestions ?? [] };
      } catch {
        // Network error: keep 'unknown'.
      }
      if (seq === checkSeq.current) setCheck(result);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [nick, check.state]);

  const onNickChange = (raw: string) => {
    nickTouched.current = true;
    const value = normaliseNickInput(raw);
    setNick(value);
    runCheck(value);
  };

  const pickSuggestion = (value: string) => {
    nickTouched.current = true;
    checkSeq.current++;
    setNick(value);
    setCheck({ state: 'available' });
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    if (name.trim() !== profile.draft.displayName) {
      let saved: OwnerProfile | undefined;
      let patchError: unknown;
      try {
        ({ data: saved, error: patchError } = await api.PATCH('/api/v1/me/profile', {
          body: { version: profile.version, displayName: name.trim() },
        }));
      } catch {
        patchError = undefined;
      }
      if (!saved) {
        setSaving(false);
        return setError(
          (patchError as Problem | undefined)?.detail ?? 'Nie udało się zapisać nazwy.',
        );
      }
      setProfile(saved);
    }
    let result;
    try {
      result = await api.PUT('/api/v1/me/profile/nick', { body: { nick } });
    } catch {
      setSaving(false);
      return setError('Nie udało się zapisać adresu. Sprawdź połączenie i spróbuj ponownie.');
    }
    const { data, error: nickError, response } = result;
    setSaving(false);
    if (data) {
      router.push('/kreator/tresc');
      return;
    }
    const problem = nickError as (Problem & { suggestions?: string[] }) | undefined;
    if (response.status === 409 && problem?.code !== 'nick_locked') {
      setCheck({ state: 'taken', suggestions: problem?.suggestions ?? [] });
    } else if (response.status === 422) {
      setCheck({ state: 'invalid' });
    } else {
      setError(problem?.detail ?? 'Nie udało się zapisać adresu. Spróbuj ponownie.');
    }
  };

  if (!profile && loadFailed) {
    return (
      <main className={styles.main}>
        <Alert variant="danger">Nie udało się wczytać Twojej strony.</Alert>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setLoadFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          Spróbuj ponownie
        </button>
      </main>
    );
  }

  if (!profile) {
    return (
      <p className="muted" role="status">
        Wczytywanie…
      </p>
    );
  }

  const locked = profile.nickLocked;
  const canContinue =
    !saving &&
    name.trim().length > 0 &&
    (check.state === 'available' || check.state === 'current' || check.state === 'unknown');
  const isError = check.state === 'taken' || check.state === 'invalid';
  const isOk = check.state === 'available' || check.state === 'current';

  return (
    <>
      <main className={styles.main}>
        <h1 className={styles.title}>Jak masz się przedstawiać?</h1>
        <p className={styles.lead}>
          Nazwa jest widoczna na stronie. Adres możesz zmienić tylko przed pierwszą publikacją.
        </p>
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="field">
          <label className="field-label" htmlFor="displayName">
            Imię i nazwisko lub pseudonim
          </label>
          <input
            id="displayName"
            className="input"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="nick">
            Adres Twojej strony
          </label>
          <div className={`input-group${isError ? ' is-error' : isOk ? ' is-success' : ''}`}>
            <span className="prefix">{host}/user/</span>
            <input
              id="nick"
              className="input"
              value={nick}
              maxLength={40}
              disabled={locked}
              aria-invalid={isError || undefined}
              aria-describedby="nick-status nick-rule"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onNickChange(event.target.value)}
            />
            {check.state === 'checking' && (
              <span className="state">
                <span className="spinner" aria-hidden="true" />
              </span>
            )}
            {isError && (
              <span className={`state ${styles.danger}`}>
                <X className="i" aria-hidden="true" />
              </span>
            )}
            {isOk && (
              <span className={`state ${styles.success}`}>
                <CheckIcon className="i" aria-hidden="true" />
              </span>
            )}
          </div>
          <span id="nick-status" role="status" aria-live="polite">
            {check.state === 'checking' && (
              <span className="hint">Sprawdzamy, czy adres jest wolny…</span>
            )}
            {check.state === 'available' && (
              <span className="hint is-success">
                <CheckIcon className="i sm" aria-hidden="true" />
                Adres wolny. Rezerwujemy go dla Ciebie po przejściu dalej.
              </span>
            )}
            {check.state === 'invalid' && (
              <span className="hint is-error">
                <CircleAlert className="i sm" aria-hidden="true" />
                {NICK_RULE}
              </span>
            )}
            {check.state === 'unknown' && (
              <span className="hint">
                Nie udało się teraz sprawdzić adresu. Sprawdzimy go, gdy przejdziesz dalej.
              </span>
            )}
            {check.state === 'taken' && (
              <span className="hint is-error">
                <CircleAlert className="i sm" aria-hidden="true" />
                Ten adres jest już zajęty.
                {check.suggestions.length > 0 && ' Może któryś z tych?'}
              </span>
            )}
            {locked && (
              <span className="hint">Adresu nie można zmienić po pierwszej publikacji.</span>
            )}
          </span>
          {check.state === 'taken' && check.suggestions.length > 0 && (
            <div className={styles.chips}>
              {check.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="chip"
                  onClick={() => pickSuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <span id="nick-rule" className="hint">
            3–40 znaków: małe litery, cyfry i myślniki. Polskie znaki zamienimy automatycznie.
          </span>
        </div>
      </main>
      <div className={styles.bar}>
        <span />
        <button
          type="button"
          className={`btn btn-primary${saving ? ' is-loading' : ''}`}
          disabled={!canContinue}
          onClick={save}
        >
          Dalej →
        </button>
      </div>
    </>
  );
}
