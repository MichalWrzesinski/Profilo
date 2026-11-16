'use client';

import { useState } from 'react';
import { normaliseNickInput } from '@/lib/nick';

/**
 * The address field of „Zarezerwuj adres”: shows the address as it will be (lower case,
 * hyphens, Polish letters replaced) while typing. Without JavaScript the plain form still
 * works and the registration page normalises the value.
 */
export function ClaimNickInput() {
  const [value, setValue] = useState('');
  return (
    <input
      className="input"
      name="adres"
      placeholder="twoje-imie"
      aria-label="Wybrany adres strony"
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      maxLength={60}
      value={value}
      onChange={(event) => setValue(normaliseNickInput(event.target.value))}
    />
  );
}
