# Standard wdrożeń i utrzymania produkcji dla agentów AI

Wersja: 1.3.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard przy wdrażaniu zmian na staging i produkcję, powrocie do poprzedniej wersji, kopiach zapasowych, monitoringu i obsłudze awarii produkcji. Dokument określa, co dzieje się automatycznie, co wymaga zgody człowieka i jak agent postępuje, gdy produkcja nie działa.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasady nadrzędne

- **Staging automatycznie, produkcja za zgodą.** Wdrożenie na staging odbywa się bez udziału człowieka. Wdrożenie na produkcję zatwierdza człowiek.
- **Wdrażasz tylko opublikowany obraz.** Na każde środowisko trafia obraz zbudowany przez CI z gałęzi głównej, nigdy kod z maszyny lokalnej.
- **Każde wydanie można cofnąć.** Przed wdrożeniem wiadomo, do której wersji i w jaki sposób można wrócić.
- **Przy awarii najpierw przywróć działanie, potem szukaj przyczyny.**

## Wdrożenie na staging

- Po publikacji obrazu z gałęzi głównej CI automatycznie wdraża go na staging.
- Po wdrożeniu CI uruchamia testy dymne: szybkie sprawdzenie głównych przepływów, np. logowania i kluczowej funkcji.
- Nieudane wdrożenie lub testy dymne zatrzymują drogę zmiany na produkcję. Agent traktuje to jak błąd do naprawy w nowym zadaniu.

## Wdrożenie na produkcję

### Zgoda człowieka

- Wdrożenie produkcyjne wykonuje osobny workflow, np. `Deploy production`, uruchamiany ręcznie, z chronionym środowiskiem GitHub `production`, które wymaga zatwierdzenia przez człowieka.
- Wdrożenie można rozpocząć na dwa sposoby:
  - człowiek uruchamia workflow w GitHub Actions;
  - agent uruchamia workflow, gdy użytkownik o to poprosi. Workflow czeka wtedy na zatwierdzenie w GitHubie.
- Agent nie zatwierdza wdrożenia, nie omija chronionego środowiska i nie wdraża na produkcję z pominięciem workflow, np. ze swojej maszyny lub przez SSH.
- Chronione środowisko blokuje zatwierdzenie wdrożenia przez osobę lub token, który je uruchomił. Agent nie korzysta z tokenu z uprawnieniem do zatwierdzania wdrożeń.

### Gotowość do wdrożenia

Gdy staging jest zielony, agent zgłasza gotowość do wdrożenia:

- listę zmian od ostatniego wydania, np. tytuły PR;
- wersję obrazu, czyli identyfikator commita;
- migracje w wydaniu, z oznaczeniem nieodwracalnych;
- drobne decyzje produktowe i widoki zaprojektowane przez agenta, do sprawdzenia na stagingu;
- nowe sekrety i konfiguracja wymagane na produkcji;
- link do workflow wdrożenia.

### Przebieg

Workflow produkcyjny wykonuje kolejno:

1. kopię zapasową bazy;
2. migracje zgodne z działającą wersją aplikacji;
3. wdrożenie bez przestoju: nowe kontenery przyjmują ruch dopiero po pozytywnym sprawdzeniu gotowości;
4. weryfikację po wdrożeniu: punkt gotowości, testy dymne i liczbę błędów w pierwszych minutach;
5. automatyczny powrót do poprzedniego obrazu, gdy weryfikacja się nie powiedzie;
6. oznaczenie wydania w GitHubie, np. tag i GitHub Release z listą PR, oraz utworzenie wydania w narzędziu monitoringu błędów.

## Powrót do poprzedniej wersji

- Powrót polega na wdrożeniu poprzedniego obrazu. Migracje zgodne z działającą wersją aplikacji pozwalają na to bez cofania bazy.
- Workflow produkcyjny wykonuje powrót automatycznie, gdy weryfikacja po wdrożeniu się nie powiedzie.
- Powrót wykonywany później, np. przy awarii zauważonej po kilku godzinach, agent uruchamia bez zgody człowieka osobnym workflow, np. `Rollback production`. Workflow przyjmuje wyłącznie obraz, który był już wcześniej zatwierdzony i wdrożony na produkcję, i odrzuca każdy inny.
- Po powrocie agent od razu informuje użytkownika: przyczyna, wersja, do której wrócono, i stan aplikacji.
- Odtworzenie bazy z kopii zapasowej powoduje utratę danych zapisanych po kopii. Wymaga zgody człowieka.

## Kopie zapasowe

- Kopie bazy danych i plików użytkowników wykonuj automatycznie, co najmniej raz dziennie, oraz przed każdą migracją produkcyjną.
- Kopie są szyfrowane i przechowywane poza serwerem aplikacji, u innego dostawcy lub w innej lokalizacji.
- Czas przechowywania ustala projekt; domyślnie 30 dni.
- Odtwarzanie kopii jest testowane automatycznie, np. raz w miesiącu na osobnym środowisku. Wynik testu jest raportowany.

## Monitoring i alerty

- Błędy backendu i frontendu zgłaszaj do Sentry lub narzędzia wskazanego przez projekt.
- Integracja z Sentry:
  - wydanie (`release`) to identyfikator commita, a środowisko (`environment`) to nazwa środowiska;
  - CI tworzy wydanie w Sentry przy każdym wdrożeniu i wiąże je z commitami; połączenie Sentry z repozytorium GitHub pozwala wskazać commit, który prawdopodobnie wprowadził błąd;
  - CI przesyła do Sentry mapy źródeł frontendu i nie publikuje ich na serwerze;
  - zgłoszenia nie zawierają danych osobowych, haseł ani tokenów; wyłącz domyślne wysyłanie danych użytkownika i filtruj wrażliwe pola.
- Monitor dostępności sprawdza z zewnątrz punkt kontroli stanu produkcji i stagingu.
- Alerty trafiają kanałem wskazanym przez projekt, domyślnie e-mailem, przy: niedostępności aplikacji, nagłym wzroście liczby błędów, nieudanym wdrożeniu, nieudanej kopii zapasowej.

## Awaria produkcji

1. **Ustal stan:** co nie działa, od kiedy, kogo dotyczy. Sprawdź alerty, zgłoszenia w Sentry, logi, punkt gotowości i ostatnie wdrożenie.
2. **Poinformuj użytkownika od razu**, krótko: objawy, zasięg, prawdopodobna przyczyna i proponowane działanie.
3. **Przywróć działanie:**
   - jeśli awaria zaczęła się po wdrożeniu, wróć do poprzedniej zatwierdzonej wersji workflow powrotu, bez czekania na zgodę;
   - jeśli przyczyną jest usługa zewnętrzna lub infrastruktura, sprawdź, czy aplikacja przeszła w działanie ograniczone, i zgłoś stan użytkownikowi.
4. **Nie naprawiaj na produkcji.** Nie zmieniaj kodu, konfiguracji ani danych bezpośrednio na serwerze lub w bazie. Poprawka przechodzi zwykłą drogę zmiany, z pierwszeństwem przed innymi zadaniami.
5. **Po przywróceniu działania** zapisz krótki opis w pliku zadania z poprawką: przyczyna, skutki, naprawa i zabezpieczenie przed powtórzeniem, np. nowy test, alert lub zmiana procesu.

## Kryteria zakończenia

- Staging jest wdrażany automatycznie z testami dymnymi; nieudany staging zatrzymuje drogę na produkcję.
- Produkcja jest wdrażana wyłącznie przez workflow z zatwierdzeniem człowieka; agent nie zatwierdza wdrożeń. Bez zgody agent wykonuje tylko powrót do wersji wcześniej zatwierdzonej i wdrożonej na produkcję.
- Zgłoszenie gotowości zawiera listę zmian, wersję obrazu, migracje, elementy do sprawdzenia na stagingu, wymagane sekrety i link do workflow.
- Wdrożenie produkcyjne ma kopię zapasową, weryfikację i automatyczny powrót do poprzedniej wersji.
- Odtworzenie bazy z kopii wykonano tylko za zgodą człowieka.
- Kopie zapasowe są automatyczne, szyfrowane, poza serwerem i regularnie testowane.
- Sentry zna wydanie i commit każdego błędu; alerty działają.
- Awaria została zgłoszona użytkownikowi od razu, działanie przywrócono bez zmian bezpośrednio na produkcji, a przyczynę i zabezpieczenie zapisano.
