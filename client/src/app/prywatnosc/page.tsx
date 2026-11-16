import type { Metadata } from 'next';
import { LegalDocument, Placeholder, Section } from '@/features/legal/LegalDocument';
import styles from '@/features/legal/LegalDocument.module.css';
import { OPERATOR } from '@/lib/operator';

export const metadata: Metadata = {
  title: 'Polityka prywatności — Profilo',
  description: 'Jakie dane przetwarza Profilo, w jakim celu, jak długo i jakie masz prawa.',
};

/** GDPR information (art. 13). Draft by the development team; the operator reviews it. */
export default function PrivacyPage() {
  return (
    <LegalDocument title="Polityka prywatności">
      <Section id="administrator" title="1. Kto jest administratorem danych">
        <p>
          Administratorem Twoich danych osobowych jest{' '}
          <Placeholder value={OPERATOR.name} label="nazwa operatora" />,{' '}
          <Placeholder value={OPERATOR.address} label="adres" />, NIP{' '}
          <Placeholder value={OPERATOR.taxId} label="NIP" />. W sprawach danych osobowych pisz na{' '}
          <Placeholder value={OPERATOR.contactEmail} label="e-mail kontaktowy" />.
        </p>
      </Section>

      <Section id="dane" title="2. Jakie dane przetwarzamy i po co">
        <div
          className={styles.tableWrap}
          tabIndex={0}
          role="region"
          aria-label="Dane, cele i podstawy prawne"
        >
          <table>
            <thead>
              <tr>
                <th>Dane</th>
                <th>Cel</th>
                <th>Podstawa prawna (RODO)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>E-mail do logowania, hasło (tylko jako skrót, którego nie da się odwrócić)</td>
                <td>
                  Założenie konta, logowanie, wiadomości o koncie (potwierdzenie adresu, reset i
                  zmiana hasła, usunięcie konta)
                </td>
                <td>Wykonanie umowy — art. 6 ust. 1 lit. b</td>
              </tr>
              <tr>
                <td>
                  Dane, które sam wpisujesz na stronę: imię i nazwisko lub pseudonim, nagłówek,
                  opis, stanowisko, firma, miejscowość, publiczny e-mail i telefon, linki, zdjęcia
                </td>
                <td>Prowadzenie Twojej strony i pokazywanie jej odwiedzającym po publikacji</td>
                <td>Wykonanie umowy — art. 6 ust. 1 lit. b</td>
              </tr>
              <tr>
                <td>Adres IP, czas i adres żądania</td>
                <td>
                  Bezpieczeństwo: limity prób (np. logowania), ochrona przed botami, wykrywanie
                  nadużyć i błędów
                </td>
                <td>Prawnie uzasadniony interes — art. 6 ust. 1 lit. f</td>
              </tr>
              <tr>
                <td>Adres e-mail podany przy rejestracji, logowaniu albo resecie hasła</td>
                <td>
                  Liczniki prób chroniące przed odgadywaniem haseł i masowym sprawdzaniem adresów
                </td>
                <td>Prawnie uzasadniony interes — art. 6 ust. 1 lit. f</td>
              </tr>
              <tr>
                <td>
                  Treść zgłoszeń nadużyć i korespondencji, w tym dane zgłaszającego i osób, których
                  zgłoszenie dotyczy
                </td>
                <td>Rozpatrywanie zgłoszeń treści niezgodnych z prawem i kontakt z Tobą</td>
                <td>
                  Obowiązek prawny (akt o usługach cyfrowych) — art. 6 ust. 1 lit. c, oraz prawnie
                  uzasadniony interes — lit. f
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          E-mail do logowania nigdy nie jest pokazywany na Twojej stronie. Ze zdjęć usuwamy dane
          EXIF, w tym lokalizację. Nie profilujemy Cię i nie podejmujemy wobec Ciebie
          zautomatyzowanych decyzji. Podanie danych jest dobrowolne, ale bez e-maila i hasła nie
          założysz konta.
        </p>
      </Section>

      <Section id="okres" title="3. Jak długo przechowujemy dane">
        <ul>
          <li>
            Dane konta i strony — do usunięcia konta. Usuwasz je w ustawieniach konta, od razu i na
            zawsze.
          </li>
          <li>
            Konto, którego e-mail nie zostanie potwierdzony w ciągu 7 dni, usuwamy automatycznie.
          </li>
          <li>
            Kopie zapasowe bazy danych i zdjęć przechowujemy przez 30 dni, więc usunięte dane
            znikają z nich najpóźniej po 30 dniach. Kopie nie są używane do niczego poza
            odtworzeniem serwisu po awarii.{' '}
            <Placeholder value={null} label="potwierdzenie po wdrożeniu kopii zapasowych" />
          </li>
          <li>
            Adres Twojej strony (nick) po usunięciu konta jest zablokowany przez 30 dni, żeby nikt
            nie przejął adresu, który niedawno udostępniałeś.
          </li>
          <li>
            Adresy IP i adresy e-mail w licznikach prób — najwyżej 1 godzinę; adresy IP w
            dziennikach serwera — 14 dni.
          </li>
          <li>
            Zgłoszenia nadużyć — przez czas potrzebny do ich rozpatrzenia i ewentualnego odwołania,
            nie dłużej niż <Placeholder value={null} label="okres przechowywania zgłoszeń" />.
          </li>
        </ul>
      </Section>

      <Section id="odbiorcy" title="4. Komu powierzamy dane">
        <p>
          Korzystamy z usług podmiotów, które przetwarzają dane w naszym imieniu (na podstawie umów
          powierzenia):
        </p>
        <ul>
          <li>
            <b>Hetzner Online GmbH</b> (Niemcy) — serwery i kopie zapasowe.
          </li>
          <li>
            <b>Brevo SAS</b> (Francja) — wysyłka wiadomości e-mail o koncie.
          </li>
          <li>
            <b>Functional Software, Inc. (Sentry)</b> — informacje o błędach aplikacji, w regionie
            danych UE. Zgłoszenie błędu zawiera opis błędu, adres podstrony, kilkanaście ostatnio
            otwartych podstron serwisu i zapytań do serwera (same adresy) oraz nazwę i wersję
            przeglądarki i systemu; nie zapisujemy kliknięć ani treści formularzy. Przed wysłaniem
            usuwamy ze zgłoszenia adresy e-mail, hasła, tokeny, numery telefonów i adresy IP.{' '}
            <Placeholder value={null} label="potwierdzenie umowy powierzenia z Sentry" />
          </li>
          <li>
            Dostawca skrzynki do zgłoszeń nadużyć i korespondencji —{' '}
            <Placeholder value={null} label="dostawca poczty operatora" />.
          </li>
        </ul>
        <p>
          Dane serwisu przechowujemy w Unii Europejskiej. Jeśli któryś dostawca przekazywałby dane
          poza Europejski Obszar Gospodarczy, odbywa się to na podstawie standardowych klauzul
          umownych zatwierdzonych przez Komisję Europejską.{' '}
          <Placeholder value={null} label="potwierdzenie regionów i umów powierzenia" />
        </p>
        <p>
          Dane z opublikowanej strony są publiczne: widzi je każdy, kto zna jej adres, a
          wyszukiwarki mogą je zaindeksować.
        </p>
      </Section>

      <Section id="zgloszenia" title="5. Dane w zgłoszeniach nadużyć">
        <p>
          Jeśli ktoś zgłosi Twoją stronę, przetwarzamy treść zgłoszenia i dane zgłaszającego, aby je
          rozpatrzyć (dane pochodzą od zgłaszającego — art. 14 RODO). Danych zgłaszającego nie
          ujawniamy właścicielowi strony, chyba że jest to konieczne do rozpatrzenia sprawy albo
          wymaga tego prawo.
        </p>
      </Section>

      <Section id="prawa" title="6. Twoje prawa">
        <p>Masz prawo do:</p>
        <ul>
          <li>dostępu do swoich danych i otrzymania ich kopii,</li>
          <li>sprostowania danych — większość z nich zmienisz sam w edytorze,</li>
          <li>usunięcia danych — usuń konto w ustawieniach albo napisz do nas,</li>
          <li>ograniczenia przetwarzania i przeniesienia danych,</li>
          <li>sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie,</li>
          <li>
            wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193
            Warszawa).
          </li>
        </ul>
      </Section>

      <Section id="cookies" title="7. Pliki cookie i pamięć przeglądarki">
        <p>
          Używamy tylko niezbędnego pliku cookie sesji (<code>profilo_rt</code>), który utrzymuje
          zalogowanie przez 30 dni od ostatniej aktywności. W pamięci przeglądarki zapisujemy
          niezapisane jeszcze zmiany w edytorze i czyścimy je przy wylogowaniu. Nie używamy
          ciasteczek reklamowych ani analitycznych, dlatego nie prosimy o zgodę.
        </p>
      </Section>

      <Section id="zmiany" title="8. Zmiany polityki">
        <p>
          O zmianach tej polityki poinformujemy na tej stronie, a o zmianach dotyczących Twoich praw
          — także e-mailem.
        </p>
      </Section>
    </LegalDocument>
  );
}
