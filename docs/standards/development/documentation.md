# Standard dokumentacji technicznej dla agentów AI

Wersja: 1.6.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard przy tworzeniu i zmianie dokumentacji technicznej projektu: README, dokumentacji API, zapisów decyzji technicznych i instrukcji dla agentów AI. Dokument określa, co dokumentować, gdzie, w jakiej formie i kiedy aktualizować.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasady nadrzędne

- **Dokumentacja opisuje aktualny stan.** Nieaktualna dokumentacja jest błędem. Aktualizuj ją w tej samej zmianie, która zmienia opisane zachowanie, a dokumentację zbędną usuwaj.
- **Krótko i konkretnie.** Prosta informacja i prosty przykład zamiast długiego opisu. Pisz tylko to, czego czytelnik potrzebuje, aby zrozumieć i użyć projektu.
- **Bez powielania.** Każda informacja jest w jednym miejscu. Nie opisuj tego, co jasno wynika z kodu, konfiguracji lub automatycznie generowanej dokumentacji.
- **Język angielski.** Cała dokumentacja techniczna jest po angielsku.
- **Czytelna dla ludzi i agentów AI.** Struktura i treść są jednoznaczne, tak aby człowiek i agent mogli z nich korzystać bez zgadywania.

## Podział dokumentacji

Dokumentacja projektu ma dwie części o różnych właścicielach. Obie są w repozytorium.

| Część | Domyślne miejsce | Kto tworzy i aktualizuje |
|---|---|---|
| Instrukcje dla agentów AI | `AGENTS.md` lub `CLAUDE.md` | development, w zmianie z kodem |
| README | `README.md`, `<aplikacja>/README.md` | development, w zmianie z kodem |
| Kontrakt API | `docs/api/openapi.yaml` | projektowanie tworzy, development aktualizuje w zmianie z kodem |
| Architektura: moduły, model danych, dane wrażliwe, mapa kodu | `docs/architecture.md` | projektowanie lub inwentaryzacja tworzy, development aktualizuje w zmianie z kodem |
| Decyzje techniczne | `docs/decisions/` | development, w zmianie z kodem |
| Opis produktu, logika biznesowa, wymagania | `docs/product/` | etapy projektowania i planowania |
| Makiety, design system | `docs/design/` | etapy projektowania i planowania |
| Zadania i raporty | `docs/tasks/` | planowanie tworzy zadanie, development dopisuje raport |

- Projekt korzysta z tego układu. Dokumentację istniejącego projektu w innym układzie przenosi jednorazowo inwentaryzacja na etapie planowania.
- Development nie zmienia dokumentacji projektowej: `docs/product/` i `docs/design/`.
- Gdy implementacja ujawnia rozbieżność z dokumentacją projektową, np. reguła biznesowa jest niewykonalna albo niepełna, zgłoś ją w raporcie zadania. Nie dostosowuj dokumentacji projektowej do kodu.

## Forma

- Pisz w Markdown, z czytelną hierarchią nagłówków i krótkimi sekcjami.
- Komendy umieszczaj w blokach kodu z oznaczonym językiem, gotowe do skopiowania i uruchomienia. Wskaż katalog, z którego się je uruchamia, jeśli nie jest to katalog główny repozytorium.
- Używaj dokładnych nazw plików, ścieżek, zmiennych i komend. Unikaj niejednoznacznych odwołań, np. „ten plik”, „tamta usługa”.
- Opcje i warianty przedstawiaj w tabelach lub listach, nie w długich akapitach.
- Przy każdej nieoczywistej instrukcji dodaj krótki przykład.
- Linkuj do innych dokumentów w repozytorium ścieżkami względnymi.

## README

README wyjaśnia, czym jest projekt, do czego służy, jak go uruchomić i używać. Nie jest materiałem reklamowym.

Stosuj typowy układ i pomijaj sekcje, które nie dotyczą projektu:

1. **Nazwa i opis:** jeden krótki akapit: czym jest projekt i do czego służy.
2. **Wymagania:** narzędzia i wersje potrzebne do uruchomienia, np. Docker, język, baza danych.
3. **Szybki start:** minimalna sekwencja komend od sklonowania repozytorium do działającej aplikacji.
4. **Konfiguracja:** odniesienie do szablonu zmiennych środowiskowych, np. `.env.example`, z opisem tylko tych zmiennych, których znaczenie nie jest oczywiste.
5. **Komendy:** testy, lint, analiza statyczna, build, migracje, seed.
6. **Struktura:** krótki opis głównych katalogów, tylko pierwszego poziomu.
7. **Dalsza dokumentacja:** linki do dokumentacji API i innych dokumentów w repozytorium.
8. **Licencja**, jeśli projekt ją określa.

W repozytorium wielu aplikacji katalog główny ma README opisujące całość, a każda aplikacja, np. `api/`, `client/`, `admin/`, własne README z jej uruchomieniem i komendami.

## Dokumentacja API

- Dokumentację API generuj automatycznie z kodu w formacie OpenAPI, mechanizmem frameworka lub uznaną biblioteką, np. NelmioApiDocBundle w Symfony, wbudowanym generatorem w FastAPI.
- Pisz kod tak, aby generator poprawnie odczytał API:
  - typowane obiekty żądań i odpowiedzi zamiast luźnych tablic;
  - jawny model odpowiedzi dla każdego zwracanego statusu, także dla błędów;
  - wyliczenia dla pól o zamkniętym zbiorze wartości;
  - przykładowe wartości dla pól, których format nie jest oczywisty.
- Gdy generator nie potrafi sam odczytać punktu końcowego, uzupełnij opis atrybutami lub adnotacjami przeznaczonymi dla generatora, np. atrybutami OpenAPI w PHP. Preferuj atrybuty języka przed blokami komentarzy, jeśli narzędzie je obsługuje.
- Opisy słowne dodawaj tylko tam, gdzie nazwa i typ nie wystarczają, np. reguła biznesowa, ograniczenie, efekt uboczny.
- Wygenerowana specyfikacja jest dostępna w środowisku deweloperskim, np. pod adresem `/api/docs`. Jeśli projekt commituje specyfikację, aktualizuj ją w tej samej zmianie co API.

## Decyzje techniczne

- Zapisuj tylko decyzje nietypowe lub istotne: odstępstwo od standardów, wybór o długoterminowych konsekwencjach, wybór między kilkoma realnymi wariantami, rozwiązanie, które przyszły czytelnik mógłby uznać za błąd.
- Nie zapisuj decyzji wynikających wprost ze standardów lub konwencji frameworka.
- Każda decyzja to krótki plik w `docs/decisions/`, np. `0003-use-uuid-public-ids.md`, z sekcjami: kontekst, decyzja, konsekwencje. Zwykle wystarcza kilkanaście linii.
- Decyzję, która przestała obowiązywać, oznacz jako zastąpioną i wskaż nową. Nie usuwaj jej.

## Instrukcje dla agentów AI

- Projekt ma jeden główny plik instrukcji dla agentów, np. `AGENTS.md` lub `CLAUDE.md`, zgodnie z konwencją używanego narzędzia. Jeśli projekt obsługuje kilka narzędzi, pozostałe pliki odsyłają do głównego zamiast powielać treść.
- Plik zawiera tylko informacje specyficzne dla projektu, których nie da się łatwo odczytać z kodu:
  - nadpisania standardów obowiązujące w projekcie;
  - komendy uruchomienia, testów i kontroli;
  - nieoczywiste pułapki i ograniczenia;
  - konwencje projektu wykraczające poza standardy.
- Plik nie zawiera opisu struktury katalogów, historii zmian, statusów zadań ani treści powielonych z README.

### Profil techniczny

- Plik instrukcji zawiera sekcję `Technical profile`: krótki spis rozwiązań technicznych obowiązujących w projekcie. Agent korzysta z niej zamiast analizować kod, aby ustalić zastane rozwiązania.
- Profil powstaje przed rozpoczęciem developmentu: w nowym projekcie z decyzji podjętych przy projektowaniu, w istniejącym projekcie z jednorazowej analizy projektu na etapie planowania.
- Profil obejmuje, jeśli dotyczy projektu:
  - języki, frameworki i ich wersje;
  - bazę danych, narzędzie migracji, cache, kolejki;
  - styl API, format błędów, paginację, wersjonowanie;
  - uwierzytelnianie;
  - narzędzia testów, analizy statycznej i formatowania, z wartościami bazowymi, np. pokryciem i poziomem analizy;
  - framework frontendu, sposób stylowania, bibliotekę komponentów, tłumaczenia;
  - przechowywanie plików;
  - CI, hosting, sposób wdrożeń, monitoring;
  - odstępstwa od standardów z krótkim uzasadnieniem.
- Każdy wpis to jedna linia z konkretną nazwą i wersją, np. `Database: PostgreSQL 18, migrations: Doctrine Migrations`.
- Gdy zmiana zmienia rozwiązanie techniczne opisane w profilu, zaktualizuj profil w tym samym commicie.
- Zastane rozwiązanie ustalone podczas zadania, którego brakowało w profilu, dopisz do profilu. To uzupełnienie faktów, a nie zmiana zasad.
- Agent sam dopisuje trwałe fakty, które ustalił podczas pracy, np. nową komendę, pułapkę środowiska. Robi to krótko, w tej samej zmianie, której dotyczą, i wymienia je w raporcie.
- Zmian zasad, nadpisań standardów i zakresu uprawnień agenta w tym pliku nie wprowadzaj samodzielnie. Zaproponuj je w raporcie zadania.

## Czego nie dokumentujemy

- Historii zmian: wynika z historii commitów. Changelog prowadź tylko wtedy, gdy projekt tak określa.
- Działania kodu, które wynika z nazw i struktury.
- Informacji tymczasowych, np. stanu bieżącego zadania, w dokumentacji projektu.
- Tych samych treści w kilku miejscach.

## Kryteria zakończenia

- Dokumentacja opisuje stan po zmianie; nieaktualne fragmenty są poprawione lub usunięte.
- README pozwala uruchomić i używać projektu bez dodatkowych wyjaśnień.
- Dokumentacja API generuje się poprawnie i obejmuje zmienione punkty końcowe z modelami żądań, odpowiedzi i błędów.
- Nietypowe lub istotne decyzje są zapisane krótko w `docs/decisions/`.
- Instrukcje dla agentów zawierają nowe trwałe fakty; zmiany zasad są tylko zaproponowane w raporcie.
- Profil techniczny opisuje stan po zmianie i zawiera rozwiązania ustalone podczas zadania.
- Dokumentacja projektowa nie została zmieniona; rozbieżności są zgłoszone w raporcie.
- Treści są krótkie, po angielsku, jednoznaczne i niepowielone.
