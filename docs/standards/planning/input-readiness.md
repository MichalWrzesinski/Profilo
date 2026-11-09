# Standard sprawdzenia gotowości (bramka wejścia) dla agentów AI

Wersja: 1.4.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard, zanim powstaną zadania do realizacji: przed planowaniem nowego projektu, przy pierwszym kontakcie z istniejącym projektem i przy każdym nowym zleceniu w istniejącym projekcie. Dokument określa, jakie materiały są potrzebne, jak sprawdzić ich komplet, jak jednorazowo poznać istniejący projekt, dostosować jego dokumentację do standardów i jak zebrać braki w jednym pytaniu.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasada nadrzędna

Development zaczyna się dopiero wtedy, gdy każda potrzebna informacja istnieje albo agent może ją wyprowadzić według standardów i powszechnie przyjętych praktyk. Wszystkie braki, które wymagają decyzji człowieka, zbierz przed rozpoczęciem pracy, w jednej wiadomości. Celem jest brak pytań w trakcie developmentu.

## Warunki wstępne

Zanim zaczniesz sprawdzanie, potwierdź warunki wstępne. Niespełniony warunek zatrzymuje cały proces: nie planuj ani nie realizuj żadnej części zlecenia i nie szukaj obejść.

1. Projekt jest repozytorium Git z repozytorium zdalnym na GitHubie.
2. Agent ma dostęp do wszystkich repozytoriów, których dotyczy zlecenie.
3. Projekt ma kopię standardów w `docs/standards/` albo agent może ją dodać.

Gdy warunek nie jest spełniony, wyślij jedną wiadomość: który warunek nie jest spełniony, dlaczego proces nie może się rozpocząć i jak go spełnić, np. „Mogę założyć repozytorium według standardu zakładania projektu; potrzebuję potwierdzenia”. Bez odpowiedzi użytkownika nie podejmuj działań.

W nowym projekcie warunki spełnia etap zakładania projektu, więc bramka wejścia działa po nim.

Niespełniony warunek wstępny różni się od braku blokującego: brak blokujący wstrzymuje tylko zależne od niego części, a niespełniony warunek wstępny wstrzymuje wszystko.

## Kiedy stosować

| Sytuacja | Zakres sprawdzenia |
|---|---|
| Nowy projekt, po etapie projektowania | Pełna lista dla nowego projektu |
| Pierwszy kontakt z istniejącym projektem | Jednorazowa inwentaryzacja projektu |
| Nowe zlecenie w istniejącym projekcie | Lista dla zlecenia, w obszarze, którego dotyczy |
| Zmiana materiałów, np. nowy kontrakt lub nowe makiety | Ponowne sprawdzenie tylko zmienionych materiałów i zadań, które z nich korzystają |

## Rodzaje braków

Każdy brak przypisz do jednej kategorii:

| Kategoria | Co obejmuje | Co robi agent |
|---|---|---|
| **Blokujący** | Istotna decyzja produktowa: cel, użytkownicy i role, reguła biznesowa, zmiana zachowania, na którym polegają użytkownicy, sprawy pieniędzy, prawne i danych osobowych, wybór płatnego dostawcy, koszty | Zbiera w pytaniu z gotową propozycją; nie planuje części od niego zależnych |
| **Uzupełniany przez agenta** | Wszystko, co można wyprowadzić z materiałów, istniejących wzorców, standardów i powszechnie przyjętych praktyk | Uzupełnia sam, zapisuje w dokumentacji projektu i wymienia w wyniku bramki |
| **Potrzebny przed wdrożeniem** | Hosting, domena, sekrety i konta produkcyjne, dostęp do środowisk | Nie wstrzymuje developmentu; trafia na listę rzeczy do przygotowania przed wdrożeniem |

W razie wątpliwości, czy brak jest blokujący, sprawdź, czy błędne założenie dałoby się później łatwo i tanio zmienić. Jeśli tak, uzupełnij brak sam i oznacz założenie do sprawdzenia na stagingu. Jeśli nie, traktuj brak jako blokujący.

## Nowy projekt

| Materiał | Jeśli brakuje | Gdzie zapisać |
|---|---|---|
| Cel produktu, użytkownicy, problem do rozwiązania | Blokujący | `docs/product/` |
| Role i uprawnienia użytkowników | Blokujący | `docs/product/` |
| Zakres pierwszej wersji z kryteriami akceptacji | Blokujący | `docs/product/` |
| Reguły biznesowe: obliczenia, statusy i przejścia między nimi, limity, terminy | Blokujący | `docs/product/` |
| Języki aplikacji | Blokujący, bo wpływa na architekturę tekstów | `docs/product/` |
| Szczególne wymogi prawne, np. płatności kartowe, dane medyczne, dane dzieci | Blokujący | `docs/product/` |
| Wybrani dostawcy usług zewnętrznych, np. płatności, wysyłki | Blokujący, bo wiąże się z kosztami i umową | `docs/product/` |
| Makiety kluczowych widoków | Blokujący | `docs/design/` |
| Design system: tokeny i komponenty | Uzupełniany: agent wyprowadza go z makiet | `docs/design/` |
| Widoki pomocnicze, np. ustawienia, listy, stany błędów i pustych danych | Uzupełniany: z komponentów i wzorców UX | `docs/design/` |
| Teksty interfejsu | Uzupełniany | w kodzie lub plikach tłumaczeń |
| Stack technologiczny | Uzupełniany według standardów | profil techniczny |
| Kontrakt API | Uzupełniany: agent wyprowadza go z wymagań | `docs/api/` |
| Model danych | Uzupełniany: agent wyprowadza go z wymagań | `docs/decisions/` dla decyzji nietypowych |
| Wymagania niefunkcjonalne: dostępność, wydajność, skala | Uzupełniany według standardów; blokujący tylko przy wymaganiu wyższym niż standard | `docs/product/` |
| Repozytorium | Uzupełniany, jeśli agent ma dostęp do konta; w przeciwnym razie blokujący | — |
| Hosting, domena, sekrety produkcyjne, konta u dostawców | Potrzebny przed wdrożeniem | lista przed wdrożeniem |

## Istniejący projekt: inwentaryzacja

Inwentaryzację wykonaj raz, przy pierwszym kontakcie z projektem. Jej wynikiem jest wiedza, dzięki której każde kolejne zadanie sięga tylko do potrzebnego fragmentu kodu. Nie czytaj całego kodu. Działaj w trzech poziomach, od najtańszego.

### Poziom 1: dane z narzędzi

Zbierz informacje, które dają narzędzia, bez czytania kodu:

- języki i wielkość kodu według katalogów, np. narzędziem `cloc` lub `tokei`;
- manifesty zależności i pliki blokady: frameworki, biblioteki, wersje, przestarzałe i podatne pakiety z audytu zależności;
- konfigurację: framework, Docker, CI, zmienne środowiskowe z szablonu;
- historię Git z ostatnich 12 miesięcy: najczęściej zmieniane pliki, czyli miejsca, gdzie toczy się praca i powstają błędy;
- wyniki kontroli: testy, pokrycie, analizę statyczną, lint. Zapisz je jako wartości wyjściowe;
- instrukcje i proces projektu: pliki instrukcji dla agentów, opis procesu pracy, hooki, własne komendy, układ dokumentacji i format zadań.

### Poziom 2: mapa struktury z narzędzi frameworka

Zbuduj mapę aplikacji z poleceń i plików, które opisują ją w całości, zamiast czytać implementację:

- trasy i punkty końcowe, np. `bin/console debug:router`, `php artisan route:list`, wygenerowana specyfikacja OpenAPI;
- schemat bazy danych z bazy lub migracji, czyli rzeczywisty model danych;
- zadania w tle, zadania cykliczne, komendy konsolowe, nasłuchujący zdarzeń;
- integracje zewnętrzne: biblioteki klientów usług w manifestach i adresy usług w konfiguracji;
- moduły: główne katalogi kodu i ich odpowiedzialność, wyznaczone na podstawie struktury, tras i schematu bazy.

### Poziom 3: próbki kodu

Przeczytaj tylko wybrane fragmenty:

- po jednym reprezentatywnym przykładzie każdego wzorca: kontroler, logika aplikacji, encja, repozytorium, test, migracja, komponent frontendu;
- kilka najczęściej zmienianych i największych plików, pobieżnie, w poszukiwaniu pułapek, np. ukrytych zależności, obejść, kodu wrażliwego na zmiany;
- miejsca oznaczone jako `TODO`, `FIXME`, `HACK` tylko w formie liczby i lokalizacji, bez analizy każdego.

### Duża aplikacja

- Na poziomie 3 opisz każdy moduł jednym, dwoma zdaniami. Szczegóły modułu poznawaj dopiero wtedy, gdy zadanie go dotyczy, i dopisuj je do mapy kodu.
- W repozytorium wielu aplikacji, np. `api/`, `client/`, `admin/`, wykonaj inwentaryzację osobno dla każdej.
- Nie przekraczaj poziomu 3. Jeśli inwentaryzacja wymaga więcej, mapa jest zbyt szczegółowa.

### Wynik inwentaryzacji

- **Profil techniczny** w pliku instrukcji dla agentów, np. `AGENTS.md`: stack, wersje, zastane rozwiązania, wartości wyjściowe kontroli, powiązane repozytoria, np. frontend lub panel administratora utrzymywane osobno.
- **Mapa kodu** w dokumentacji technicznej, domyślnie `docs/architecture.md`: dla każdego modułu ścieżki, odpowiedzialność, główne encje i punkty końcowe, stan testów i znane ryzyka.
- **Lista problemów** zapisana jako propozycje zadań: niedziałające uruchomienie lub testy, przestarzałe i podatne zależności, brak kluczowych narzędzi kontroli.
- **Dokumentacja dostosowana do standardów**, opisana w sekcji „Dostosowanie dokumentacji”.

Inwentaryzacja nie zmienia kodu aplikacji.

## Istniejący projekt: dostosowanie dokumentacji

Dokumentacja projektu ma jedno źródło prawdy w układzie i formacie tych standardów. Jeśli istniejący projekt ma dokumentację w innym układzie lub formacie, przenieś ją jednorazowo, zaraz po inwentaryzacji.

| Materiał projektu | Docelowo |
|---|---|
| Opis produktu, wymagania, historie użytkownika, reguły | `docs/product/` w formacie dokumentacji produktu ze standardu analizy produktu |
| Makiety, styl, tokeny, logo | `docs/design/` według standardu projektowania wyglądu |
| Decyzje techniczne i produktowe, ADR | `docs/decisions/` |
| Kontrakt API | `docs/api/openapi.yaml` |
| Otwarte zadania | `docs/tasks/` w formacie standardu planowania zadań, z odpowiednim statusem |
| Instrukcje dla agentów | `AGENTS.md` z profilem technicznym; pliki instrukcji konkretnych narzędzi, np. `CLAUDE.md`, `.github/copilot-instructions.md`, `.github/instructions/`, zostają, ale tylko odsyłają do `AGENTS.md` |

- Przenoszenie nie zmienia znaczenia treści. Niejasności i sprzeczności wykryte przy przenoszeniu traktuj jak braki bramki wejścia.
- Zadania zakończone nie są przenoszone. Ich historia zostaje w Git.
- Stare pliki dokumentacji i opis starego procesu usuń w tej samej zmianie. Nie zostawiaj kopii ani odsyłaczy, aby nie powstały dwa źródła prawdy. Treść pozostaje dostępna w historii Git.
- Zasady starego procesu pracy, np. zatwierdzanie planu przez człowieka, nie przechodzą automatycznie. Zapytaj w wyniku bramki, czy któreś z nich zachować jako nadpisania standardów w `AGENTS.md`, z rekomendacją przyjęcia standardów w całości.
- Jeśli stary proces lub inny zespół nadal aktywnie korzysta ze starej dokumentacji, nie przenoś jej. To brak blokujący: dwa równoległe źródła prawdy nie są dopuszczalne.
- Dostosowanie wykonaj jako osobne zadanie z jednym PR, przed zadaniami zlecenia.

## Istniejący projekt: nowe zlecenie

Dla każdego zlecenia sprawdź, korzystając z profilu i mapy kodu:

1. **Cel i efekt:** co ma się zmienić i po czym poznać, że działa.
2. **Obszar zmiany:** których modułów dotyczy, według mapy kodu.
3. **Granice repozytorium:** czy wszystkie aplikacje, których dotyczy zlecenie, np. backend, frontend klienta, panel administratora, są w projekcie albo w powiązanych repozytoriach z profilu technicznego. Brak dostępu do potrzebnej aplikacji jest brakiem blokującym.
4. **Obecne zachowanie:** czy obszar ma opis w `docs/product/`. Jeśli nie ma, odtwórz obecne zachowanie z kodu tylko w obszarze zmiany i zapisz je w `docs/product/`, w formacie dokumentacji produktu ze standardu analizy produktu.
5. **Założenia zlecenia:** sprawdź w modelu danych i kodzie, czy to, na czym opiera się zlecenie, istnieje i działa tak, jak zakłada zlecenie, np. czy istnieją dane, które ma pokazać nowy widok. Fałszywe założenie jest brakiem blokującym. Przedstaw, jak jest naprawdę, i warianty realizacji.
6. **Sprzeczności:** czy zlecenie przeczy zapisanym decyzjom, regułom biznesowym lub kryteriom akceptacji w obszarze zmiany. Każda sprzeczność jest brakiem blokującym, także gdy zlecenie pochodzi od użytkownika: mogła zmienić się koncepcja, ale wcześniejsze ustalenie mogło też zostać zapomniane. Przedstaw sprzeczność z cytatem wcześniejszego ustalenia i propozycją, jak je pogodzić ze zleceniem.
7. **Wygląd:** czy nowe widoki da się zbudować z istniejących komponentów i wzorców. Jeśli zlecenie wymaga nowego obszaru produktu bez wzorca, skieruj je do projektowania.
8. **Typowe braki:** sprawdź listę z sekcji „Typowe braki”.

## Typowe braki

Zadania najczęściej nie opisują poniższych spraw. Sprawdź każdą jawnie. Jeśli materiały jej nie rozstrzygają, zastosuj rozwiązanie domyślne, chyba że kolumna wskazuje brak blokujący.

| Sprawa | Rozwiązanie domyślne | Kiedy brak jest blokujący |
|---|---|---|
| Uprawnienia: kto może użyć funkcji | Istniejący model ról, najmniejsze potrzebne uprawnienia | Funkcja wymaga nowej roli lub zmiany zasad dostępu |
| Istniejące dane | Migracja zachowuje dane i ich znaczenie | Zmiana zmienia znaczenie danych lub wymaga decyzji, co zrobić z istniejącymi rekordami |
| Usuwanie | Rekordy z historią finansową lub prawną archiwizuj statusem; pozostałe usuwaj po potwierdzeniu | Wymogi przechowywania lub usuwania danych osobowych |
| Przypadki brzegowe i błędy | Zachowanie według standardów i wzorców aplikacji: walidacja, komunikat, możliwość ponowienia | Przypadek dotyczy pieniędzy lub reguły biznesowej |
| Walidacja i limity pól | Rozsądne limity dla typu pola, np. długość tekstu, zakres dat | Limit biznesowy, np. maksymalna kwota, liczba sztuk |
| Awaria usługi zewnętrznej | Według standardu backendu: kontrolowany wynik, ponowienia tylko bezpieczne | Brak możliwości działania bez dostawcy wymaga decyzji o ograniczeniu funkcji |
| Powiadomienia | Tylko powiadomienia niezbędne dla procesu, np. potwierdzenie płatności | Nowe powiadomienia do użytkowników lub osób trzecich |
| Historia zmian i audyt | Zdarzenia bezpieczeństwa według standardu bezpieczeństwa | Wymóg historii widocznej dla użytkownika lub audytu prawnego |
| Raporty i eksport | Nie dodawaj, jeśli zadanie ich nie wymaga | — |
| Widok mobilny | Mobile first według standardu frontendu | — |
| Wydajność i wolumen danych | Paginacja, indeksy i limity według standardów | Wymagany wolumen lub czas odpowiedzi wyraźnie wyższy niż typowy |
| Teksty i tłumaczenia | Teksty w językach z profilu, napisane przez agenta | Nowy język aplikacji |
| Zgodność API dla istniejących klientów | Zmiany zgodne wstecz według standardu backendu | Konieczna zmiana łamiąca zgodność |
| Widoczność danych: kto zobaczy nowe dane | Rola widzi tylko dane, które widziała dotąd, oraz własne dane | Rola zobaczy dane dotąd dla niej niedostępne, np. dane innych użytkowników, kody kampanii, ceny wewnętrzne |

## Weryfikacja praktyczna

- Uruchom aplikację i kontrole komendami projektu, np. `make up` i `make check`. Nie poprzestawaj na lekturze dokumentacji.
- Zapisz wynik kontroli jako wartości wyjściowe w profilu technicznym.
- Niedziałające uruchomienie lub kontrole to brak uzupełniany przez agenta: zapisz go jako pierwsze zadanie do wykonania przed zadaniami zlecenia.

## Wynik bramki

1. Przygotuj jedną wiadomość dla użytkownika:
   - **braki blokujące**: przy każdym jego skutek i gotowa propozycja z rekomendacją, tak aby użytkownik mógł odpowiedzieć „tak” albo poprawić wybrane punkty;
   - **uzupełnienia agenta**: krótka lista najważniejszych założeń, oznaczonych do sprawdzenia na stagingu;
   - **rzeczy potrzebne przed wdrożeniem**.
2. Jeśli nie ma braków blokujących, nie czekaj na odpowiedź. Przekaż wiadomość jako informację i przejdź do planowania zadań.
3. Po odpowiedzi użytkownika zapisz ustalenia w dokumentacji projektu: decyzje produktowe w `docs/product/`, wygląd w `docs/design/`, rozwiązania techniczne w profilu technicznym. Nie twórz osobnego raportu bramki.
4. Części niezależne od braków blokujących możesz planować i realizować bez czekania na odpowiedź.

## Powrót do projektowania

Skieruj zlecenie do etapu projektowania, gdy wymaga nowego obszaru produktu, którego nie da się zbudować z istniejących wzorców, np. nowego modułu z własnymi ekranami, rolami i regułami biznesowymi. Projektowanie obejmuje wtedy tylko ten obszar, nie całą aplikację.

## Kryteria zakończenia

- Warunki wstępne zostały potwierdzone; przy niespełnionym warunku proces zatrzymano bez żadnej pracy i zgłoszono, jak go spełnić.
- Każdy materiał z listy właściwej dla sytuacji został sprawdzony i przypisany do kategorii braku.
- Istniejący projekt ma profil techniczny, mapę kodu i wartości wyjściowe kontroli z jednorazowej inwentaryzacji wykonanej bez czytania całego kodu.
- Dokumentacja istniejącego projektu jest przeniesiona do układu i formatu standardów; stare pliki usunięto, a zasady starego procesu zachowano tylko jako zatwierdzone nadpisania.
- Sprzeczności zlecenia z wcześniejszymi decyzjami i regułami oraz fałszywe założenia zlecenia są przedstawione jako braki blokujące.
- Wszystkie aplikacje potrzebne do zlecenia są dostępne albo ich brak zgłoszono.
- Aplikację i kontrole uruchomiono; niedziałające elementy są zapisane jako pierwsze zadanie.
- Typowe braki zostały sprawdzone jawnie; rozwiązania domyślne są zapisane.
- Braki blokujące zebrano w jednej wiadomości z propozycjami; bez nich bramka nie czeka na odpowiedź.
- Ustalenia są zapisane w dokumentacji projektu, a nie w osobnym raporcie.
- Zlecenia wymagające nowego obszaru produktu skierowano do projektowania.
