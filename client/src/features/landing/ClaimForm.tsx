'use client';

import { Globe, Lightbulb } from 'lucide-react';
import { useId, useState } from 'react';
import { normaliseNickInput } from '@/lib/nick';
import styles from './Landing.module.css';

const PLACEHOLDER = 'twoja-nazwa';

/**
 * „Zarezerwuj adres”: the field shows the address as it will be (lower case, hyphens, Polish
 * letters replaced) while typing, with a short prefix; the full address is spelled out below.
 * A plain GET form: without JavaScript it still works and the registration page normalises the
 * value.
 */
export function ClaimForm({ host }: { host: string }) {
  const [value, setValue] = useState('');
  const addressId = useId();
  return (
    <>
      <form className={styles.claim} action="/rejestracja" method="get">
        <label className="input-group">
          <span className="prefix">/user/</span>
          <input
            className="input"
            name="adres"
            placeholder={PLACEHOLDER}
            aria-label="Wybrany adres strony"
            aria-describedby={addressId}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={60}
            value={value}
            onChange={(event) => setValue(normaliseNickInput(event.target.value))}
          />
        </label>
        <button type="submit" className="btn btn-primary">
          Zarezerwuj adres
        </button>
      </form>
      <p className={`hint ${styles.note}`}>
        <Lightbulb className="i sm" aria-hidden="true" />
        Adres możesz zmienić aż do pierwszej publikacji
      </p>
      <p id={addressId} className={`hint ${styles.address}`}>
        <Globe className="i sm" aria-hidden="true" />
        <span>
          {host}/user/<b>{value || PLACEHOLDER}</b>
        </span>
      </p>
    </>
  );
}
