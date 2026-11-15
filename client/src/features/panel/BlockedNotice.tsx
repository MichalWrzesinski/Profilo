import { CircleAlert } from 'lucide-react';
import Link from 'next/link';

/** Shown to the owner of a page the operator blocked (PUB-BR-10). */
export function BlockedNotice() {
  return (
    <div className="alert alert-danger banner" role="alert">
      <CircleAlert className="i" aria-hidden="true" />
      <span className="grow">
        <b>Strona zablokowana — skontaktuj się z nami.</b> Odwiedzający widzą zamiast niej
        informację, że strona nie istnieje. Uzasadnienie otrzymasz e-mailem;{' '}
        <Link href="/regulamin#zgloszenia">jak się odwołać</Link>.
      </span>
    </div>
  );
}
