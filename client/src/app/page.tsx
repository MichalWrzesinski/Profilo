import Image from 'next/image';
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
      </div>
    </main>
  );
}
