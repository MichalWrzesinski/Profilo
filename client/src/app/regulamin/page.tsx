import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument, Placeholder, Section } from '@/features/legal/LegalDocument';
import { OPERATOR } from '@/lib/operator';

export const metadata: Metadata = {
  title: 'Regulamin — Profilo',
  description:
    'Zasady korzystania z Profilo: konto, treści, zgłaszanie nadużyć i odpowiedzialność.',
};

/** Terms of service, including the DSA notice-and-action rules. Draft for the operator. */
export default function TermsPage() {
  const abuse = OPERATOR.abuseEmailConfirmed ? OPERATOR.abuseEmail : null;
  return (
    <LegalDocument title="Regulamin">
      <Section id="uslugodawca" title="1. Usługodawca">
        <p>
          Serwis Profilo prowadzi <Placeholder value={OPERATOR.name} label="nazwa operatora" />,{' '}
          <Placeholder value={OPERATOR.address} label="adres" />, NIP{' '}
          <Placeholder value={OPERATOR.taxId} label="NIP" />, e-mail{' '}
          <Placeholder value={OPERATOR.contactEmail} label="e-mail kontaktowy" /> („my”).
        </p>
      </Section>

      <Section id="usluga" title="2. Czym jest Profilo">
        <p>
          Profilo pozwala założyć bezpłatną stronę-wizytówkę pod stałym adresem z opisem, danymi
          kontaktowymi i linkami. Usługa jest świadczona drogą elektroniczną. Wystarczy aktualna
          przeglądarka internetowa i adres e-mail.
        </p>
      </Section>

      <Section id="konto" title="3. Konto">
        <ul>
          <li>
            Konto zakładasz, podając e-mail, hasło i nazwę oraz akceptując ten regulamin. Umowa
            zostaje zawarta z chwilą założenia konta, na czas nieokreślony.
          </li>
          <li>
            Aby opublikować stronę, musisz potwierdzić e-mail. Konto niepotwierdzone w ciągu 7 dni
            usuwamy.
          </li>
          <li>
            Dbaj o poufność hasła. Jeśli podejrzewasz, że ktoś zna Twoje hasło, zmień je —
            wylogujemy Cię wtedy na innych urządzeniach.
          </li>
          <li>
            Możesz w każdej chwili usunąć konto w ustawieniach. Usuwamy wtedy od razu konto, stronę,
            zdjęcia i linki; adres strony jest zablokowany przez 30 dni.
          </li>
        </ul>
      </Section>

      <Section id="tresci" title="4. Twoje treści">
        <ul>
          <li>
            Odpowiadasz za treści, które publikujesz. Musisz mieć do nich prawa, w tym do zdjęć.
          </li>
          <li>
            Nie publikuj treści niezgodnych z prawem, w szczególności naruszających prawa innych
            osób, wprowadzających w błąd co do tożsamości (podszywanie się), nawołujących do
            nienawiści lub przemocy, ani linków do złośliwego oprogramowania lub wyłudzeń.
          </li>
          <li>
            Udzielasz nam niewyłącznej, nieodpłatnej licencji na przechowywanie i wyświetlanie
            Twoich treści w zakresie potrzebnym do działania strony. Licencja wygasa z usunięciem
            treści lub konta.
          </li>
          <li>Opublikowana strona jest publiczna i może być indeksowana przez wyszukiwarki.</li>
          <li>
            Jeśli strona zawiera treści niezgodne z prawem albo rażąco narusza ten regulamin, możemy
            ją zablokować, a przy powtarzających się naruszeniach — zablokować konto. Zawsze
            podajemy uzasadnienie (punkt 5).
          </li>
        </ul>
      </Section>

      <Section id="zgloszenia" title="5. Zgłaszanie treści niezgodnych z prawem">
        <p>
          Każdy może zgłosić treść, która jego zdaniem jest niezgodna z prawem — linkiem „Zgłoś
          nadużycie” w stopce każdej strony albo e-mailem na{' '}
          <Placeholder value={abuse} label="adres do zgłoszeń nadużyć" />. Zgłoszenie powinno
          zawierać:
        </p>
        <ol>
          <li>wyjaśnienie, dlaczego treść jest niezgodna z prawem,</li>
          <li>dokładny adres strony (URL), a w razie potrzeby wskazanie fragmentu,</li>
          <li>
            imię i nazwisko oraz e-mail zgłaszającego (nie dotyczy niektórych przestępstw, m.in.
            wobec dzieci),
          </li>
          <li>
            oświadczenie, że zgłaszający w dobrej wierze uważa informacje za prawdziwe i kompletne.
          </li>
        </ol>
        <p>
          Potwierdzamy otrzymanie zgłoszenia, rozpatrujemy je bez zbędnej zwłoki i informujemy
          zgłaszającego o decyzji. Zgłoszenia rozpatruje człowiek, bez zautomatyzowanych narzędzi.
        </p>
        <p>
          Jeśli zablokujemy stronę lub konto, przekażemy właścicielowi uzasadnienie: co zrobiliśmy,
          na podstawie jakich faktów, czy uznaliśmy treść za niezgodną z prawem (i z jakim
          przepisem), czy z regulaminem (i z którym punktem), oraz jakie ma możliwości odwołania.
          Odwołać się — zarówno właściciel strony, jak i zgłaszający, gdy nie podjęliśmy działań —
          można w ciągu 6 miesięcy na adres{' '}
          <Placeholder value={OPERATOR.contactEmail} label="e-mail do odwołań" />; odwołanie
          rozpatruje inna osoba niż ta, która podjęła decyzję. Można też skorzystać z
          certyfikowanego organu pozasądowego rozstrzygania sporów (art. 21 aktu o usługach
          cyfrowych) albo z drogi sądowej.
        </p>
        <p>
          Punkt kontaktowy dla użytkowników oraz dla organów państw członkowskich i Komisji
          Europejskiej: <Placeholder value={OPERATOR.contactEmail} label="punkt kontaktowy DSA" />.
          Kontaktujemy się po polsku i po angielsku.
        </p>
      </Section>

      <Section id="odpowiedzialnosc" title="6. Dostępność i odpowiedzialność">
        <ul>
          <li>
            Staramy się, aby serwis działał bez przerw, ale możemy go czasowo wyłączyć, np. na czas
            prac technicznych.
          </li>
          <li>
            Nie odpowiadamy za treści publikowane przez użytkowników, o ile — po uzyskaniu
            wiarygodnej informacji o ich bezprawnym charakterze — niezwłocznie uniemożliwimy do nich
            dostęp.
          </li>
          <li>
            Usługa jest bezpłatna. W granicach prawa nie odpowiadamy za utracone korzyści wynikające
            z przerw w działaniu serwisu.
          </li>
        </ul>
      </Section>

      <Section id="reklamacje" title="7. Reklamacje">
        <p>
          Reklamacje dotyczące działania serwisu wyślij na{' '}
          <Placeholder value={OPERATOR.contactEmail} label="e-mail do reklamacji" />. Odpowiemy w
          ciągu 14 dni.
        </p>
      </Section>

      <Section id="zmiany" title="8. Zmiany regulaminu i postanowienia końcowe">
        <ul>
          <li>
            O zmianach regulaminu poinformujemy e-mailem co najmniej 14 dni przed ich wejściem w
            życie. Jeśli się nie zgadzasz, możesz usunąć konto.
          </li>
          <li>
            Dane osobowe przetwarzamy zgodnie z <Link href="/prywatnosc">Polityką prywatności</Link>
            .
          </li>
          <li>
            Prawem właściwym jest prawo polskie. Konsument może skorzystać z pozasądowych sposobów
            rozpatrywania sporów.
          </li>
        </ul>
      </Section>
    </LegalDocument>
  );
}
