'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useSession } from '@/lib/session';

/** Shared account navigation; the editor saves pending changes before leaving. */
export function AccountMenu({
  beforeLeave,
  beforeSignOut,
}: {
  beforeLeave?: () => Promise<boolean>;
  beforeSignOut?: () => Promise<boolean>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useSession();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open) return;
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div style={{ position: 'relative' }} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className="btn btn-primary btn-sm"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        Moje konto
      </button>
      {open && (
        <nav
          id={id}
          className="menu"
          aria-label="Menu konta"
          style={{ position: 'absolute', right: 0, top: '110%' }}
        >
          {[
            { href: '/panel', label: 'Mój panel' },
            { href: '/edytor', label: 'Edytuj wizytówkę' },
            { href: '/panel/konto', label: 'Ustawienia konta' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              className="menu-item"
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                if (beforeLeave) {
                  event.preventDefault();
                  void beforeLeave().then((leave) => {
                    if (leave) {
                      setOpen(false);
                      router.push(href);
                    }
                  });
                } else setOpen(false);
              }}
            >
              {label}
            </Link>
          ))}
          <hr />
          <button
            type="button"
            className="menu-item"
            onClick={async () => {
              const guard = beforeSignOut ?? beforeLeave;
              if (guard && !(await guard())) return;
              await signOut();
              router.replace('/logowanie');
            }}
          >
            Wyloguj się
          </button>
        </nav>
      )}
    </div>
  );
}
