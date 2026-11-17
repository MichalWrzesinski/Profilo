import Link from 'next/link';

export function Logo({ size }: { size?: number }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden="true">
      <rect width="44" height="44" rx="11" fill="#0F2747" />
      <path
        d="M15 32V12h8.5a6.5 6.5 0 0 1 0 13H15"
        fill="none"
        stroke="#fff"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31" cy="31" r="3.4" fill="#E0592A" />
    </svg>
  );
}

/**
 * Logo and name with a small „DEMO” mark, linking home. Crowded top bars (panel, wizard, editor) pass
 * `nameOnPhones={false}`: the name then shows above 860 px only, so they still fit 320 px.
 */
export function Brand({ nameOnPhones = true }: { nameOnPhones?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Profilo — strona główna">
      <Logo />
      <span className={nameOnPhones ? undefined : 'hide-m'}>
        Profi
        {/* „DEMO” (drawn by CSS, decorative) starts above the „l”: this server is a demo. */}
        <span className="brand-demo">l</span>o
      </span>
    </Link>
  );
}
