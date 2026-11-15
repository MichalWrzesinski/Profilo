'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type Props = {
  labelledBy: string;
  describedBy?: string;
  className?: string;
  /** Escape, a click outside and the close buttons call it; may change on every render. */
  onClose: () => void;
  children: ReactNode;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog (design system `.scrim` + `.modal`): focus on `[data-autofocus]`, kept inside
 * while open (also when it fell out), Escape and a click outside close it, and the focus
 * returns where it was.
 */
export function Modal({ labelledBy, describedBy, className, onClose, children }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  // The latest onClose without re-running the effect below (which moves the focus).
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab' || !dialog.current) return;
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (!dialog.current.contains(document.activeElement)) {
        // The focus fell out (a click on text, a control that disappeared).
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close.current();
      }}
    >
      <div
        ref={dialog}
        className={`modal${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        {children}
      </div>
    </div>
  );
}
