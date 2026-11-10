import { Mail } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Logo } from '@/components/Brand';
import { ABUSE_EMAIL, initials, mailtoHref, type PublicProfile } from '@/lib/publicProfile';

/**
 * Public page, Classic layout without a banner (PUB-BR-1, PUB-BR-4). A server component:
 * the content and the contact button work without JavaScript (PUB-BR-8).
 */
export function ClassicPage({ profile }: { profile: PublicProfile }) {
  const { content, canonicalUrl } = profile;
  const accent = { '--page-accent': `var(--page-accent-${content.accent})` } as CSSProperties;
  const abuse = mailtoHref(ABUSE_EMAIL, `Zgłoszenie nadużycia: ${canonicalUrl}`);
  return (
    <div className="pp pp-classic" style={accent}>
      <main className="main no-banner">
        <div className="head">
          <div className="avatar" role="img" aria-label={content.displayName}>
            {initials(content.displayName)}
          </div>
          <h1>{content.displayName}</h1>
          {content.headline && <p className="headline">{content.headline}</p>}
          {content.publicEmail && (
            <div className="contact">
              <a className="btn btn-primary" href={mailtoHref(content.publicEmail)}>
                <Mail className="i" aria-hidden="true" />
                Napisz e-mail
              </a>
            </div>
          )}
        </div>
        <footer>
          <Link className="made" href="/">
            <Logo size={16} />
            Utworzono w Profilo
          </Link>
          <a href={abuse}>Zgłoś nadużycie</a>
        </footer>
      </main>
    </div>
  );
}
