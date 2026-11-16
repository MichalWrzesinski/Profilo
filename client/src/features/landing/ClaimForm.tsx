'use client';

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
      <p id={addressId} className={styles.address}>
        {host}/user/<b>{value || PLACEHOLDER}</b>
      </p>
    </>
  );
}
