import { LayoutTemplate, Mail, QrCode } from 'lucide-react';
import { Caveat } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import { ClaimForm } from './ClaimForm';
import styles from './Landing.module.css';

// Handwritten caption next to the example page (self-hosted by next/font, latin-ext for Polish).
const handwriting = Caveat({ subsets: ['latin', 'latin-ext'], weight: ['600'], display: 'swap' });

const FEATURES = [
  {
    icon: LayoutTemplate,
    title: 'Trzy gotowe układy',
    text: 'Klasyczny, Dzielony albo Wizytówka. Wybierasz układ i kolor, a strona sama dopasuje się do telefonu i komputera.',
  },
  {
    icon: Mail,
    title: 'Kontakt jednym dotknięciem',
    text: 'Przyciski „Napisz e-mail” i „Zadzwoń”. Sam decydujesz, co pokazać. E-mail do logowania pozostaje prywatny.',
  },
  {
    icon: QrCode,
    title: 'Stały adres i kod QR',
    text: 'Adres się nie zmienia, więc linki w CV i na wydrukowanych wizytówkach zawsze działają.',
  },
];

/**
 * Home page (PUB-BR-11): what Profilo is, and „Zarezerwuj adres” straight into sign-up. The
 * example page in the phone frame links to the same page, live, in a new tab.
 */
export function Landing({ host, exampleUrl }: { host: string; exampleUrl: string }) {
  return (
    <>
      <SiteHeader className={styles.topbar} />
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.intro}>
            <span className={`badge is-live ${styles.badge}`}>Bezpłatnie · bez kodowania</span>
            <h1>
              Twoja wizytówka w sieci <em>gotowa w 5 minut</em>
            </h1>
            <p className={styles.lead}>
              Jeden stały adres z opisem, kontaktem i linkami do Twoich profili, który łatwo
              wstawisz do CV,
              <br />
              <span className={styles.nowrap}>stopki e-</span>
              <wbr />
              <span className={styles.nowrap}>mail czy na wizytówkę</span>
            </p>
            <ClaimForm host={host} />
          </div>
          <a
            className={styles.example}
            href={exampleUrl}
            target="_blank"
            rel="noopener"
            aria-label="Zobacz na żywo przykładową stronę Anny Wiśniewskiej (otwiera się w nowej karcie)"
          >
            <span className={styles.device}>
              <iframe
                src="/przyklad"
                title="Przykładowa strona w Profilo"
                loading="lazy"
                inert
                aria-hidden="true"
              />
            </span>
            <span className={`${styles.live} ${handwriting.className}`} aria-hidden="true">
              Zobacz na żywo
              <svg
                className={styles.desktopArrow}
                viewBox="0 0 64 64"
                width="56"
                height="56"
                fill="none"
              >
                {/* From the caption: a short way right, up, then right again into the phone. */}
                <path
                  d="M3 56 C9 54 14 58 20 55 C28 53 24 44 25 37 C27 27 22 17 29 12 C36 7 47 12 58 10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M51 4 Q55 8 59 10 Q55 13 51 17"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <svg
                className={styles.mobileArrow}
                viewBox="0 0 64 64"
                width="56"
                height="56"
                fill="none"
              >
                <path
                  d="M3 9 C14 7 26 11 37 9 C48 7 51 13 50 23 C48 34 52 44 50 56"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M43 49 Q47 53 50 57 Q54 52 57 49"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </a>
        </section>
        <section className={styles.features} aria-label="Co dostajesz">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card card-pad">
              <div className={styles.icon}>
                <Icon className="i" aria-hidden="true" />
              </div>
              <h2>{title}</h2>
              <p className="muted">{text}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
