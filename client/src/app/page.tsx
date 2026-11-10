import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div>
        <Image
          className={styles.logo}
          src="/logo.svg"
          alt="Profilo"
          width={200}
          height={44}
          priority
        />
        <h1 className={styles.title}>Twoja wizytówka w sieci.</h1>
        <p className={styles.lead}>Już wkrótce: jeden stały adres z opisem, kontaktem i linkami.</p>
        <p className={styles.actions}>
          <Link className="btn btn-primary" href="/rejestracja">
            Załóż stronę
          </Link>
          <Link className="btn btn-secondary" href="/logowanie">
            Zaloguj się
          </Link>
        </p>
      </div>
    </main>
  );
}
