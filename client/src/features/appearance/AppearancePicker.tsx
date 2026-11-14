'use client';

import { Check } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { Accent, Layout } from '@/features/editor/fields';
import styles from './AppearancePicker.module.css';

export const LAYOUTS: { value: Layout; name: string; description: string }[] = [
  { value: 'classic', name: 'Klasyczny', description: 'Zdjęcie, opis i linki w jednej kolumnie.' },
  { value: 'split', name: 'Dzielony', description: 'Grafika z jednej strony, treść z drugiej.' },
  { value: 'card', name: 'Wizytówka', description: 'Zwarta karta na grafice lub kolorze.' },
];

/** The palette (PUB-BR-3); every colour is checked for contrast in every layout. */
export const ACCENTS: { value: Accent; name: string }[] = [
  { value: 'granat', name: 'Granat' },
  { value: 'niebieski', name: 'Niebieski' },
  { value: 'blekit', name: 'Błękit' },
  { value: 'morski', name: 'Morski' },
  { value: 'zielen', name: 'Zieleń' },
  { value: 'bordo', name: 'Bordo' },
  { value: 'miedz', name: 'Miedź' },
  { value: 'fiolet', name: 'Fiolet' },
];

export const layoutName = (value: Layout) => LAYOUTS.find((l) => l.value === value)?.name ?? '';
export const accentName = (value: Accent) => ACCENTS.find((a) => a.value === value)?.name ?? '';

/**
 * Keyboard for a radio group (WAI-ARIA): arrows move and select, only the checked option is
 * in the tab order.
 */
function radioKeys<T>(options: T[], value: T, onChange: (v: T) => void) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (options.indexOf(value) + step + options.length) % options.length;
    onChange(options[next]!);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
}

function Thumb({ layout }: { layout: Layout }) {
  return (
    <div className={`${styles.thumb} ${styles[layout]}`} aria-hidden="true">
      <div className={`${styles.art} hero-art`} />
      <div className={styles.body}>
        <span className={styles.face} />
        <span className={styles.line} />
        <span className={styles.wide} />
        <span className={styles.button} />
      </div>
    </div>
  );
}

export function LayoutPicker({
  value,
  onChange,
}: {
  value: Layout;
  onChange: (v: Layout) => void;
}) {
  const onKeyDown = radioKeys(
    LAYOUTS.map((l) => l.value),
    value,
    onChange,
  );
  return (
    <div className="layout-opts" role="radiogroup" aria-label="Układ strony" onKeyDown={onKeyDown}>
      {LAYOUTS.map((layout) => (
        <button
          key={layout.value}
          type="button"
          className="layout-opt"
          role="radio"
          aria-checked={value === layout.value}
          tabIndex={value === layout.value ? 0 : -1}
          onClick={() => onChange(layout.value)}
        >
          <div className="thumb">
            <Thumb layout={layout.value} />
          </div>
          <div>
            <b>{layout.name}</b>
            <p className="hint">{layout.description}</p>
          </div>
          <span className="tick" aria-hidden="true">
            <Check className="i sm" />
          </span>
        </button>
      ))}
    </div>
  );
}

export function AccentPicker({
  value,
  onChange,
}: {
  value: Accent;
  onChange: (v: Accent) => void;
}) {
  const onKeyDown = radioKeys(
    ACCENTS.map((a) => a.value),
    value,
    onChange,
  );
  return (
    <>
      <div
        className="swatches"
        role="radiogroup"
        aria-label="Kolor przewodni"
        onKeyDown={onKeyDown}
      >
        {ACCENTS.map((accent) => (
          <button
            key={accent.value}
            type="button"
            className="swatch"
            role="radio"
            aria-checked={value === accent.value}
            aria-label={accent.name}
            title={accent.name}
            tabIndex={value === accent.value ? 0 : -1}
            style={{ background: `var(--page-accent-${accent.value})` }}
            onClick={() => onChange(accent.value)}
          >
            {value === accent.value && <Check className="i sm" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <p className={styles.chosen} aria-live="polite">
        <b>{accentName(value)}</b>
        {value === 'granat' && <span className="muted"> · domyślny</span>}
      </p>
    </>
  );
}
