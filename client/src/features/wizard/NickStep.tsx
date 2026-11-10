'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/Alert';
import { api, type Problem } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { NICK_RULE, nickFormatError, normaliseNickInput } from '@/lib/nick';
import styles from './NickStep.module.css';

type OwnerProfile = components['schemas']['OwnerProfile'];
type Check =
  | { state: 'idle' | 'checking' | 'available' | 'current' | 'invalid' }
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
  const nickTouched = useRef(false);
  const host = typeof window === 'undefined' ? 'profilo.pl' : window.location.host;

  useEffect(() => {
    void api.GET('/api/v1/me/profile').then(({ data }) => {
      if (!data) return;
      setProfile(data);
      setName(data.draft.displayName);
      if (data.nick) {
        nickTouched.current = true;
        setNick(data.nick);
        setCheck({ state: 'current' });
      }
    });
  }, []);

  // Propose a nick from the name until the owner edits the nick field (PRF-BR-2).
  useEffect(() => {
    if (!profile || nickTouched.current || !name.trim()) return;
    const timer = setTimeout(async () => {
      const { data } = await api.GET('/api/v1/nicks/suggestion', {
        params: { query: { displayName: name } },
      });
      if (!nickTouched.current && data) {
        setNick(data.nick ?? '');
        setCheck({ state: data.nick ? 'available' : 'idle' });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [name, profile]);

  const runCheck = (value: string) => {
    if (nickFormatError(value)) return setCheck({ state: 'invalid' });
    if (value === profile?.nick) return setCheck({ state: 'current' });
    setCheck({ state: 'checking' });
  };

  // Live availability (PRF-BR-3), debounced.
  useEffect(() => {
    if (check.state !== 'checking') return;
    const timer = setTimeout(async () => {
      const { data } = await api.GET('/api/v1/nicks/{nick}/availability', {
        params: { path: { nick } },
      });
      if (!data) return setCheck({ state: 'idle' });
      if (data.available) setCheck({ state: 'available' });
      else if (data.reason === 'invalid_format') setCheck({ state: 'invalid' });
      else setCheck({ state: 'taken', suggestions: data.suggestions ?? [] });
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
    setNick(value);
    setCheck({ state: 'available' });
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    if (name.trim() !== profile.draft.displayName) {
      const { data, error: patchError } = await api.PATCH('/api/v1/me/profile', {
        body: { version: profile.version, displayName: name.trim() },
      });
      if (!data) {
        setSaving(false);
        return setError(
          (patchError as Problem | undefined)?.detail ?? 'Nie udało się zapisać nazwy.',
        );
      }
      setProfile(data);
    }
    const {
      data,
      error: nickError,
      response,
    } = await api.PUT('/api/v1/me/profile/nick', {
      body: { nick },
    });
    setSaving(false);
    if (data) {
      router.push('/panel');
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

  if (!profile) {
    return (
      <p className="muted" role="status">
        Wczytywanie…
      </p>
    );
  }

  const locked = profile.nickLocked;
  const groupClass =
    check.state === 'taken' || check.state === 'invalid'
      ? ' is-error'
      : check.state === 'available' || check.state === 'current'
        ? ' is-success'
        : '';
  const canContinue =
    !saving && name.trim().length > 0 && (check.state === 'available' || check.state === 'current');

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
          <div className={`input-group${groupClass}`}>
            <span className="prefix">{host}/user/</span>
            <input
              id="nick"
              className="input"
              value={nick}
              maxLength={40}
              disabled={locked}
              aria-invalid={check.state === 'taken' || check.state === 'invalid' || undefined}
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
          </div>
          <span id="nick-status" role="status" aria-live="polite">
            {check.state === 'checking' && (
              <span className="hint">Sprawdzamy, czy adres jest wolny…</span>
            )}
            {check.state === 'available' && (
              <span className="hint is-success">
                Adres wolny. Rezerwujemy go dla Ciebie po przejściu dalej.
              </span>
            )}
            {check.state === 'invalid' && <span className="hint is-error">{NICK_RULE}</span>}
            {check.state === 'taken' && (
              <span className="hint is-error">
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
