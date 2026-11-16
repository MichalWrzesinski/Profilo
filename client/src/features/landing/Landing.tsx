import { LayoutTemplate, Lightbulb, Mail, QrCode } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { ClaimForm } from './ClaimForm';
import { SiteFooter } from './SiteFooter';
import styles from './Landing.module.css';

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
    text: 'Adres się nie zmienia, więc linki w CV i na wydrukowanych wizytówkach zawsze działają.',
  },
];

/** Home page (PUB-BR-11): what Profilo is, and „Zarezerwuj adres” straight into sign-up. */
export function Landing({ host }: { host: string }) {
  return (
    <>
      <SiteHeader />
      <main>
        <section className={styles.hero}>
          <div>
            <span className={`badge badge-neutral ${styles.badge}`}>
              Bezpłatnie · bez kodowania
            </span>
            <h1>
              Twoja wizytówka w sieci <em>gotowa w 5 minut</em>
            </h1>
            <p className={styles.lead}>
              Jeden stały adres z opisem, kontaktem i linkami do Twoich profili, który łatwo
              wstawisz do CV, stopki e-mail czy na wizytówkę
            </p>
            <ClaimForm host={host} />
            <p className={`hint ${styles.note}`}>
              <Lightbulb className="i sm" aria-hidden="true" />
              Adres możesz zmienić aż do pierwszej publikacji
            </p>
          </div>
          <div className={styles.device}>
            <iframe
              src="/przyklad"
              title="Przykładowa strona w Profilo"
              loading="lazy"
              inert
              aria-hidden="true"
            />
          </div>
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
      <SiteFooter />
    </>
  );
}
