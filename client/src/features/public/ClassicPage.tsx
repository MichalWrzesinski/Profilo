import { Briefcase, Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Logo } from '@/components/Brand';
import { formatPhone } from '@/lib/phone';
import { ABUSE_EMAIL, initials, mailtoHref, type PublicProfile } from '@/lib/publicProfile';

/**
 * Public page, Classic layout without a banner (PUB-BR-1). Fixed order (PUB-BR-4): identity,
 * details, contact, bio; empty fields leave no gaps (PRF-BR-9). A server component:
 * the content and the contact button work without JavaScript (PUB-BR-8).
 */
export function ClassicPage({ profile }: { profile: PublicProfile }) {
  const { content, canonicalUrl } = profile;
  const work = [content.position, content.company].filter(Boolean).join(', ');
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
          {(work || content.city) && (
            <ul className="meta">
              {work && (
                <li>
                  <Briefcase className="i" aria-hidden="true" />
                  {work}
                </li>
              )}
              {content.city && (
                <li>
                  <MapPin className="i" aria-hidden="true" />
                  {content.city}
                </li>
              )}
            </ul>
          )}
          {(content.publicEmail || content.publicPhone) && (
            <div className="contact">
              {content.publicEmail && (
                <a className="btn btn-primary" href={mailtoHref(content.publicEmail)}>
                  <Mail className="i" aria-hidden="true" />
                  Napisz e-mail
                </a>
              )}
              {content.publicPhone && (
                <a
                  className="btn btn-secondary"
                  href={`tel:${content.publicPhone}`}
                  aria-label={`Zadzwoń: ${formatPhone(content.publicPhone)}`}
                >
                  <Phone className="i" aria-hidden="true" />
                  Zadzwoń
                </a>
              )}
            </div>
          )}
          {content.publicPhone && (
            <p className="muted">{formatPhone(content.publicPhone)}</p>
          )}
        </div>
        {content.bio && <p className="bio">{content.bio}</p>}
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
