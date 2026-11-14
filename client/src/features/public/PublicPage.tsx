import { ArrowUpRight, Briefcase, Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Logo } from '@/components/Brand';
import { LinkIcon, LinkMark, shortUrl } from '@/components/LinkIcon';
import { formatPhone } from '@/lib/phone';
import { ABUSE_EMAIL, initials, mailtoHref, type PublicProfile } from '@/lib/publicProfile';
import styles from './PublicPage.module.css';

type Content = PublicProfile['content'];
type Image = NonNullable<Content['background']>;

/** Card layout: up to this many links as icons in the card, more as a list below it. */
export const CARD_ICON_LINKS = 6;

/** `srcset` from the size → URL map of an image (sizes are widths in px). */
function srcSet(urls: Record<string, string>): string {
  return Object.entries(urls)
    .map(([size, url]) => `${url} ${size}w`)
    .join(', ');
}

function Background({ image, sizes }: { image: Image; sizes: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- variants come from /media
    <img
      className={styles.cover}
      src={image.urls['1600']}
      srcSet={srcSet(image.urls)}
      sizes={sizes}
      alt=""
      fetchPriority="high"
    />
  );
}

function Identity({ content }: { content: Content }) {
  const work = [content.position, content.company].filter(Boolean).join(', ');
  return (
    <>
      {content.avatar ? (
        <div className="avatar">
          {/* eslint-disable-next-line @next/next/no-img-element -- variants come from /media */}
          <img
            src={content.avatar.urls['256']}
            srcSet={srcSet(content.avatar.urls)}
            sizes="(max-width: 860px) 96px, 112px"
            alt={content.displayName}
            width={112}
            height={112}
          />
        </div>
      ) : (
        <div className="avatar" role="img" aria-label={content.displayName}>
          {initials(content.displayName)}
        </div>
      )}
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
    </>
  );
}

function Contact({ content }: { content: Content }) {
  if (!content.publicEmail && !content.publicPhone) return null;
  return (
    <>
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
      {content.publicPhone && <p className="muted">{formatPhone(content.publicPhone)}</p>}
    </>
  );
}

// PUB-BR-5: new tab, no referrer or opener, user content not endorsed.
const EXTERNAL = { target: '_blank', rel: 'nofollow ugc noopener noreferrer' } as const;
const NEW_TAB = ' (otwiera się w nowej karcie)';

function LinkList({ content }: { content: Content }) {
  if (content.links.length === 0) return null;
  return (
    <>
      <p className="label-caps" id="links-title">
        Znajdziesz mnie tutaj
      </p>
      <ul className="links" aria-labelledby="links-title">
        {content.links.map((link) => (
          <li key={link.id}>
            <a className="link-card" href={link.url} {...EXTERNAL}>
              <LinkIcon service={link.service} />
              <span className="txt">
                <strong>{link.label}</strong>
                <small>{shortUrl(link.url)}</small>
              </span>
              <ArrowUpRight className="i arrow" aria-hidden="true" />
              <span className="sr-only">{NEW_TAB}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function IconLinks({ content }: { content: Content }) {
  return (
    <ul className="icon-links" aria-label="Znajdziesz mnie tutaj">
      {content.links.map((link) => (
        <li key={link.id}>
          <a href={link.url} title={link.label} aria-label={`${link.label}${NEW_TAB}`} {...EXTERNAL}>
            <LinkMark service={link.service} />
          </a>
        </li>
      ))}
    </ul>
  );
}

function Footer({ canonicalUrl }: { canonicalUrl: string }) {
  return (
    <footer>
      <Link className="made" href="/">
        <Logo size={16} />
        Utworzono w Profilo
      </Link>
      <a href={mailtoHref(ABUSE_EMAIL, `Zgłoszenie nadużycia: ${canonicalUrl}`)}>
        Zgłoś nadużycie
      </a>
    </footer>
  );
}

function Bio({ content }: { content: Content }) {
  return content.bio ? <p className="bio">{content.bio}</p> : null;
}

/**
 * The public page in the owner's layout (PUB-BR-1) and accent colour (PUB-BR-3). Fixed
 * order (PUB-BR-4): identity, details, contact, bio, links; empty fields leave no gaps
 * (PRF-BR-9). Text always sits on the page or a card surface, never on the image. Without
 * a background image the default graphic in the accent colour is used. A server component:
 * content and contact buttons work without JavaScript (PUB-BR-8). Also the editor preview.
 */
export function PublicPage({ profile }: { profile: PublicProfile }) {
  const { content, canonicalUrl } = profile;
  const accent = { '--page-accent': `var(--page-accent-${content.accent})` } as CSSProperties;
  const art = (className: string, sizes: string): ReactNode => (
    <div className={`${className}${content.background ? ` ${styles.art}` : ' hero-art'}`} aria-hidden="true">
      {content.background && <Background image={content.background} sizes={sizes} />}
    </div>
  );

  if (content.layout === 'split') {
    return (
      <div className="pp pp-split" style={accent}>
        {art('side', '(max-width: 860px) 100vw, 42vw')}
        <main className="main">
          <Identity content={content} />
          <Contact content={content} />
          <Bio content={content} />
          <LinkList content={content} />
          <Footer canonicalUrl={canonicalUrl} />
        </main>
      </div>
    );
  }

  if (content.layout === 'card') {
    const asList = content.links.length > CARD_ICON_LINKS;
    return (
      <div className="pp pp-card" style={accent}>
        {art('bgfill', '100vw')}
        <main className={styles.cardStack}>
          <div className="vcard">
            <Identity content={content} />
            <Contact content={content} />
            <Bio content={content} />
            {!asList && content.links.length > 0 && <IconLinks content={content} />}
            <Footer canonicalUrl={canonicalUrl} />
          </div>
          {asList && (
            <section className={`vcard ${styles.cardLinks}`}>
              <LinkList content={content} />
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="pp pp-classic" style={accent}>
      {art(`banner ${styles.banner}`, '100vw')}
      <main className="main">
        <div className="head">
          <Identity content={content} />
          <Contact content={content} />
        </div>
        <Bio content={content} />
        <LinkList content={content} />
        <Footer canonicalUrl={canonicalUrl} />
      </main>
    </div>
  );
}
