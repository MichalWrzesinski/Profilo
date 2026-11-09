# Standard budowy backendu dla agentów AI

Wersja: 1.2.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard przy tworzeniu i zmianie backendu aplikacji. Dokument określa, jak projektować API, pracować z bazą danych i migracjami, stosować cache, zadania w tle, integracje z usługami zewnętrznymi oraz logowanie i kontrolę stanu aplikacji.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasady nadrzędne

- **Uznane rozwiązania.** Narzędzia, np. bibliotekę kolejek, cache lub klienta HTTP, dobieraj do potrzeby i frameworka. Wybieraj rozwiązania popularne, aktywnie utrzymywane i zalecane przez framework zamiast własnych mechanizmów.
- **Awaria zależności nie jest awarią aplikacji.** Niedostępna usługa zewnętrzna, cache lub kolejka nie powoduje nieobsłużonego błędu ani odpowiedzi `500`.
- **Spójność danych przed wygodą.** Dane w bazie są zawsze poprawne i kompletne, także przy błędach, ponowieniach i równoczesnych żądaniach.

## Projekt API

- Domyślny styl to REST z JSON. Inny styl, np. GraphQL, stosuj tylko wtedy, gdy wskazuje go projekt.
- Ścieżki opisują zasoby rzeczownikami w liczbie mnogiej, w kebab-case, np. `/api/v1/orders/{id}/line-items`. Akcję, która nie jest operacją na zasobie, zapisuj jako podzasób z czasownikiem, np. `POST /api/v1/orders/{id}/cancel`.
- Nazwy pól JSON zapisuj w jednej konwencji w całym API, zgodnie z ekosystemem projektu, np. camelCase albo snake_case.
- Stosuj metody HTTP zgodnie z ich znaczeniem: `GET` odczyt bez skutków ubocznych, `POST` utworzenie lub akcja, `PUT` zastąpienie, `PATCH` częściowa zmiana, `DELETE` usunięcie.
- Stosuj właściwe statusy odpowiedzi:

| Status | Kiedy |
|---|---|
| `200` | Poprawny odczyt lub zmiana z treścią odpowiedzi |
| `201` | Utworzenie zasobu; nagłówek `Location` wskazuje nowy zasób |
| `202` | Operacja przyjęta do wykonania w tle |
| `204` | Poprawna operacja bez treści odpowiedzi |
| `400` | Niepoprawna składnia żądania |
| `401` | Brak lub nieważne uwierzytelnienie |
| `403` | Brak uprawnień do operacji |
| `404` | Zasób nie istnieje lub jest niedostępny dla użytkownika |
| `409` | Konflikt ze stanem zasobu, np. równoczesna zmiana |
| `422` | Błędy walidacji danych |
| `429` | Przekroczony limit żądań; nagłówek `Retry-After` |
| `502`, `503`, `504` | Kontrolowana odpowiedź przy awarii zależności |

- Daty i czas zwracaj w formacie ISO 8601 ze strefą czasową, np. `2026-11-09T14:30:00Z`.

## Format błędów

- Wszystkie błędy API zwracaj w formacie Problem Details (RFC 9457), z typem treści `application/problem+json`.
- Każdy błąd zawiera pola `type`, `title`, `status` oraz, gdy pomaga, `detail`. Dodaj stały kod błędu czytelny dla programu, np. `code: "order_already_cancelled"`, aby klient nie musiał analizować tekstu.
- Błędy walidacji zawierają listę błędów pól:

```json
{
  "type": "https://example.com/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "code": "validation_error",
  "errors": [
    { "field": "email", "code": "invalid_format", "message": "Email has invalid format" }
  ]
}
```

## Listy, paginacja, filtrowanie

- Każda lista jest paginowana, z domyślnym i maksymalnym rozmiarem strony, np. 20 i 100. Żądanie większej strony przyjmuje wartość maksymalną.
- Domyślnie stosuj paginację stronami (`page`, `perPage`) z łączną liczbą wyników w odpowiedzi. Przy dużych lub szybko rosnących zbiorach, np. historii zdarzeń, stosuj paginację kursorem.
- Paginację wykonuj w zapytaniu do bazy, nie po pobraniu wszystkich wierszy.
- Filtrowanie i sortowanie dopuszczaj tylko po polach z jawnej listy dozwolonych, z indeksami w bazie dla często używanych.

## Wersjonowanie API

- API od początku ma numer wersji głównej w ścieżce: `/api/v1/`. To najpowszechniejsze i najprostsze rozwiązanie, czytelne dla ludzi, narzędzi i agentów AI.
- W ramach wersji wprowadzaj tylko zmiany zgodne wstecz:
  - nowy endpoint;
  - nowe pole w odpowiedzi;
  - nowy opcjonalny parametr lub pole żądania;
  - nowa wartość wyliczenia, jeśli klienci zostali przygotowani na nieznane wartości.
- Zmiana łamiąca zgodność wymaga nowej wersji, np. `/api/v2/`. Zmiana łamiąca zgodność to m.in. usunięcie lub zmiana nazwy pola, zmiana typu lub znaczenia pola, nowe pole wymagane w żądaniu, zmiana formatu błędów lub uwierzytelniania.
- Zanim wprowadzisz nową wersję, sprawdź, czy zmianę da się wykonać zgodnie wstecz, np. przez nowe pole lub nowy endpoint obok starego. Nowa wersja to wyjątek, nie sposób na każdą zmianę.
- Po wprowadzeniu nowej wersji poprzednią oznacz jako wycofywaną nagłówkami `Deprecation` i `Sunset` z datą wyłączenia, opisz to w dokumentacji API i utrzymuj ją przez zapowiedziany okres. Równolegle utrzymuj najwyżej dwie wersje.
- Własny frontend wdrażany razem z backendem także korzysta z wersjonowanego API. Usunięcie starego pola wykonuj w późniejszym wdrożeniu, gdy żaden klient już go nie używa.

## Idempotencja

- `GET`, `PUT` i `DELETE` projektuj tak, aby ich powtórzenie dawało ten sam skutek.
- Operacje `POST`, których powtórzenie szkodzi, np. płatność, zamówienie, wysyłka wiadomości, przyjmują nagłówek `Idempotency-Key`. Serwer zapisuje klucz z wynikiem na ustalony czas, np. 24 godziny, i dla powtórzonego żądania zwraca zapisany wynik bez ponownego wykonania operacji.
- Ten sam klucz z inną treścią żądania zwraca błąd `422`. Równoczesne żądanie z kluczem w trakcie przetwarzania zwraca `409`.

## Baza danych

### Wybór bazy

- W nowym projekcie domyślnie stosuj PostgreSQL. Inną bazę wybierz tylko wtedy, gdy wymaga tego charakter projektu, i zapisz decyzję z uzasadnieniem.
- Nie stosuj baz, które ograniczają aplikację serwerową w środowisku produkcyjnym, np. SQLite z jej ograniczeniami równoczesnych zapisów i zmian schematu.
- Bazy wyspecjalizowane, np. wyszukiwarkę pełnotekstową lub bazę dokumentową, dodawaj obok głównej bazy relacyjnej tylko przy realnej potrzebie, której nie spełnia baza główna.

### Schemat i spójność

- Reguły spójności zapisuj w bazie, nie tylko w kodzie: klucze obce, unikalność, `NOT NULL`, ograniczenia `CHECK`.
- Czas zapisuj w UTC, w typie ze strefą czasową, np. `timestamptz`. Strefę użytkownika stosuj dopiero przy wyświetlaniu.
- Kwoty zapisuj jako `decimal` o ustalonej precyzji albo jako liczbę całkowitą w najmniejszej jednostce, np. w groszach, zawsze z walutą. Nigdy nie stosuj liczb zmiennoprzecinkowych dla pieniędzy.
- Operacje zmieniające kilka rekordów wykonuj w jednej transakcji. Nie wywołuj usług zewnętrznych wewnątrz otwartej transakcji.
- Równoczesne zmiany tego samego rekordu zabezpieczaj blokadą optymistyczną, np. kolumną wersji, albo blokadą wiersza, np. `SELECT ... FOR UPDATE`, gdy konflikt jest częsty.

### Zapytania i wydajność

- Twórz indeksy pod realne zapytania: filtry, sortowanie, klucze obce, złączenia.
- Unikaj problemu N+1: dane powiązane pobieraj jednym zapytaniem lub mechanizmem ładowania z wyprzedzeniem ORM. Nie wykonuj zapytań w pętli.
- Pobieraj tylko potrzebne kolumny i wiersze. Przy zapytaniach do dużych tabel sprawdź plan wykonania, np. `EXPLAIN`.

### Migracje

- Każda zmiana schematu i danych startowych przechodzi przez migrację w repozytorium, tworzoną narzędziem frameworka. Nigdy nie zmieniaj schematu ręcznie.
- Nie edytuj migracji, która została już wykonana w jakimkolwiek wspólnym środowisku. Popraw ją nową migracją.
- Migracja jest zgodna z wersją aplikacji działającą przed wdrożeniem i po nim. Zmiany niezgodne wykonuj etapami (expand/contract):
  1. dodaj nową kolumnę lub tabelę;
  2. przełącz kod na nową strukturę i przenieś dane;
  3. usuń starą strukturę w późniejszym wdrożeniu.
- Migracje zmieniające dane oddzielaj od migracji schematu. Duże tabele aktualizuj partiami.
- Unikaj długich blokad dużych tabel, np. twórz indeksy w trybie nieblokującym, jeśli baza go obsługuje.
- Migrację sprawdzaj na pustej bazie i na bazie z danymi. Przygotuj migrację odwrotną, gdy to możliwe. Migrację, która nieodwracalnie usuwa dane, oznacz w opisie zmiany.

## Cache

- Dodawaj cache tylko tam, gdzie pomiar lub oczywisty koszt operacji pokazuje potrzebę.
- Każdy wpis ma czas życia i opisany sposób unieważniania przy zmianie danych.
- Klucze cache mają jednoznaczną strukturę, np. `product:{id}:v1`, i uwzględniają wszystko, od czego zależy wynik, np. użytkownika, język, uprawnienia.
- Aplikacja działa poprawnie przy pustym lub niedostępnym cache, najwyżej wolniej.
- Domyślnie stosuj Redis lub zgodny z nim Valkey, jeśli projekt nie ma innego rozwiązania.

## Zadania w tle

- Operacje długie lub zależne od usług zewnętrznych, np. wysyłkę e-maili, generowanie plików, integracje, wykonuj w tle, poza żądaniem HTTP.
- Zadanie w tle jest idempotentne: ponowne wykonanie nie powoduje podwójnego skutku.
- Zadanie ma ograniczoną liczbę ponowień z rosnącym odstępem. Po wyczerpaniu ponowień trafia do kolejki błędów i jest widoczne w logach.
- Gdy zdarzenie musi zostać wysłane po zapisie w bazie, stosuj wzorzec outbox: zapisz zdarzenie w tej samej transakcji co dane, a osobny proces je wysyła.
- Zadania cykliczne są idempotentne i nie uruchamiają się równolegle, np. dzięki blokadzie.

## Integracje z usługami zewnętrznymi

### Budowa

- Każdą integrację umieszczaj w osobnym adapterze za interfejsem. Reszta aplikacji nie zna szczegółów dostawcy.
- Każde wywołanie ma jawny, krótki limit czasu połączenia i odpowiedzi. Nie polegaj na domyślnych wartościach klienta HTTP.
- Odpowiedź dostawcy waliduj tak jak dane od użytkownika. Nieoczekiwany format jest błędem integracji, nie błędem aplikacji.

### Awaria dostawcy

- Awaria dostawcy nigdy nie powoduje odpowiedzi `500`. Zamień ją na kontrolowany wynik:
  - **przyjęcie do wykonania w tle**, gdy operacja może poczekać: odpowiedź `202`, a zadanie ponawia wywołanie, np. wysyłka wiadomości;
  - **działanie ograniczone**, gdy funkcja nie jest niezbędna: ostatnie znane dane z cache albo wyłączenie funkcji z informacją dla użytkownika;
  - **kontrolowany błąd**, gdy operacji nie da się wykonać ani odłożyć: `502`, `503` lub `504` w formacie Problem Details, z komunikatem zrozumiałym dla użytkownika i nagłówkiem `Retry-After`, jeśli ponowienie ma sens.
- Przy serii błędów dostawcy przestań tymczasowo wysyłać do niego żądania (wzorzec circuit breaker) i zwracaj od razu kontrolowany wynik.

### Ponawianie

- Ponawiaj tylko wtedy, gdy spełnione są oba warunki:
  - błąd jest przejściowy: przekroczenie czasu, błąd połączenia, `429`, `502`, `503`, `504`;
  - operacja jest bezpieczna do powtórzenia: odczyt, operacja idempotentna albo operacja z kluczem idempotencji przyjmowanym przez dostawcę.
- Ponawiaj z rosnącym odstępem i losowym rozrzutem, z limitem prób. Respektuj nagłówek `Retry-After`.
- Nie ponawiaj:
  - błędów po stronie żądania, np. `400`, `401`, `403`, `404`, `422`;
  - operacji, których powtórzenie może wywołać podwójny skutek, np. obciążenia płatnością bez klucza idempotencji.
- **Wynik nieznany**, np. przekroczenie czasu po wysłaniu płatności: nie powtarzaj operacji. Sprawdź jej stan u dostawcy, poczekaj na webhook albo oznacz ją do uzgodnienia, a użytkownikowi pokaż stan „w trakcie przetwarzania”.

### Webhooki

- Weryfikuj podpis każdego webhooka i odrzucaj niepodpisane lub przeterminowane.
- Obsługa jest idempotentna według identyfikatora zdarzenia: powtórzone zdarzenie nie powoduje ponownego skutku.
- Odpowiadaj szybko statusem `2xx`, a zdarzenie przetwarzaj w tle.
- Nie zakładaj kolejności zdarzeń. Przed zmianą stanu sprawdź, czy zdarzenie nie jest starsze od aktualnego stanu.

### Testy integracji

- W testach zastępuj dostawcę atrapą lub środowiskiem testowym dostawcy, nigdy usługą produkcyjną.
- Testuj także scenariusze awarii: przekroczenie czasu, błąd `5xx`, `429`, nieoczekiwany format odpowiedzi, powtórzony webhook.

## Logi i kontrola stanu

- Loguj strukturalnie, w formacie JSON, na standardowe wyjście. Zbieranie i przechowywanie logów należy do infrastruktury.
- Każde żądanie ma identyfikator, np. z nagłówka `X-Request-ID` lub nadany przez aplikację. Identyfikator trafia do wszystkich logów żądania, zadań w tle i wywołań usług zewnętrznych.
- Stosuj poziomy logów zgodnie z ich znaczeniem:

| Poziom | Kiedy |
|---|---|
| `error` | Operacja się nie udała i wymaga uwagi, np. wyczerpane ponowienia |
| `warning` | Sytuacja nietypowa obsłużona przez aplikację, np. ponowienie, działanie ograniczone |
| `info` | Istotne zdarzenia biznesowe i techniczne, np. utworzenie zamówienia, start aplikacji |
| `debug` | Szczegóły diagnostyczne, wyłączone w produkcji |

- Udostępniaj dwa punkty kontroli stanu:
  - `/health`: proces działa; bez sprawdzania zależności;
  - `/ready`: aplikacja może obsługiwać żądania, bo baza i niezbędne zależności są dostępne.

## Kryteria zakończenia

- API ma wersję w ścieżce, właściwe metody i statusy, a zmiany w ramach wersji są zgodne wstecz.
- Błędy API mają format Problem Details ze stałym kodem błędu.
- Listy są paginowane z limitem; filtrowanie i sortowanie działa tylko po dozwolonych polach.
- Operacje, których powtórzenie szkodzi, są idempotentne.
- Spójność danych chronią więzy w bazie i transakcje; czas jest w UTC, kwoty bez liczb zmiennoprzecinkowych.
- Zapytania mają potrzebne indeksy i nie mają problemu N+1.
- Migracje są w repozytorium, zgodne z działającą wersją aplikacji i sprawdzone na bazie z danymi.
- Cache ma czas życia i unieważnianie; aplikacja działa bez cache.
- Zadania w tle są idempotentne, z limitem ponowień i kolejką błędów.
- Awaria usługi zewnętrznej daje kontrolowany wynik, nigdy `500`; ponowienia dotyczą tylko błędów przejściowych i operacji bezpiecznych do powtórzenia.
- Webhooki mają weryfikację podpisu i idempotentną obsługę.
- Logi są strukturalne, z identyfikatorem żądania; działają `/health` i `/ready`.
