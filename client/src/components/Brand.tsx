import Link from 'next/link';

export function Brand({ withName = true }: { withName?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Profilo — strona główna">
      <svg viewBox="0 0 44 44" aria-hidden="true">
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
      {withName && <span>Profilo</span>}
    </Link>
  );
}
