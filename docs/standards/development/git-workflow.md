# Standard pracy z Git dla agentów AI

Wersja: 2.2.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard podczas planowania zmian, przygotowywania commitów, przeglądu historii i integracji branchy.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Respektuj jawne wyjątki projektu. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Uprawnienia i bezpieczeństwo

- **Autonomia:** bez pytania wykonuj pełny cykl zadania: branch roboczy, commity, push brancha roboczego, PR, aktualizację brancha względem gałęzi docelowej, merge po spełnieniu warunków integracji i usunięcie zintegrowanego brancha. Projekt lub użytkownik może ten zakres ograniczyć.
- Nie zmieniaj w ramach zadania ustawień repozytorium, ochrony branchy ani uprawnień.
- Nie omijaj hooków (`--no-verify`) ani podpisywania commitów. Gdy hook blokuje commit, usuń przyczynę; jeśli nie mieści się to w zakresie zadania, zgłoś blokadę.
- Nie przepisuj historii gałęzi docelowych, chronionych ani współdzielonych. Historię własnego brancha roboczego po publikacji możesz przepisać, np. po rebase, tylko wtedy, gdy nikt inny na nim nie pracuje, i zawsze z kontrolą oczekiwanego stanu, np. `--force-with-lease`, nigdy zwykłym force push.
- Nigdy nie usuwaj `main`, `master`, `stage`, `develop` ani innych branchy chronionych przez projekt.
- Zmian istniejących przed zadaniem nie usuwaj, nie cofaj i nie dołączaj bez związku ze zleceniem.
- Nie dodawaj sekretów ani zbędnych artefaktów generowanych.
- Nie traktuj możliwości wykonania revert jako gwarancji odwracalności migracji danych lub efektów zewnętrznych.

## Konfiguracja projektu

Odczytaj z projektu: gałąź główną i docelową, chronione branche, mapę katalogów na obszary, konwencję identyfikatorów zadań, nazwy branchy, wymagane sprawdzenia oraz ewentualne ograniczenia autonomii.

- Główna gałąź to `main` albo `master`; ustal faktyczną nazwę.
- `develop` i `stage` stosuj wyłącznie, jeśli należą do modelu pracy projektu.
- Domyślne obszary: `[api]` — backend, `[client]` — frontend klienta, `[admin]` — frontend administracyjny.
- Dodatkowe obszary, np. `[infra]`, `[docs]`, `[shared]`, wymagają jednoznacznego zakresu w projekcie. Nie używaj ich do obchodzenia rozdziału aplikacji.
- W repozytorium jednej aplikacji stosuj tag obszaru, jeśli wymaga go projekt. W repozytorium wielu aplikacji tag obszaru jest wymagany.
- Nie wymyślaj identyfikatora zadania lub iteracji. Stosuj istniejący identyfikator zgodnie z projektem; przy prostym zadaniu bez identyfikatora pomiń ten tag.

## Planowanie i granice commitów

1. Twórz częste, małe commity o jednym logicznym celu. Jedna iteracja może zawierać wiele commitów.
2. Dziel według celu i obszaru, nie mechanicznie według plików, liczby linii lub czasu pracy.
3. Nie łącz w jednym commicie zmian aplikacyjnych API, klienta i panelu administracyjnego. Funkcję przekrojową podziel na powiązane commity.
4. Dołącz testy i dokumentację bezpośrednio związaną ze zmianą do jej commita, jeśli należą do tego samego obszaru. Wspólną dokumentację i kontrakty przypisuj zgodnie z mapą projektu.
5. Commit przeznaczony do integracji nie zostawia świadomie uszkodzonego stanu: kod się buduje, a znane testy nadal przechodzą. Merge commit zachowuje wszystkie commity w historii gałęzi głównej, więc uszkodzony stan pośredni utrudnia `git bisect` i cofanie zmian. Wyjątek jest dopuszczalny tylko jawnie: opisz go w treści commita.
6. Zachowuj kompatybilność między commitami. Preferuj najpierw kompatybilne rozszerzenie API, następnie wykorzystanie go przez frontend.
7. Nie dziel nierozłącznych zmian tak, aby powstały uszkodzone stany. Jeśli nie można jednocześnie zachować rozdziału obszarów i poprawnych stanów, zmień kolejność zmian albo zastosuj jawny wyjątek opisany w treści commita.
8. Poprawkę niezależnego błędu, refaktoryzację lub porządkowanie formatowania umieszczaj w osobnym commicie.
9. Rozróżniaj roboczy checkpoint od commita przygotowanego do integracji. Nie zachowuj każdego checkpointu tylko dlatego, że już istnieje.

## Wiadomości commitów

Pisz krótko, w simple English. Opisuj konkretną zmianę czasownikiem w formie rozkazującej, np. `Add`, `Fix`, `Remove`, `Update`. Unikaj `Changes`, `Fix stuff`, `WIP` w historii przeznaczonej do integracji.

Format w repozytorium wielu aplikacji:

```text
[area][task-or-iteration] Short change description
```

- Tytuł ma najwyżej 72 znaki razem z tagami, zaczyna się wielką literą po tagach i nie kończy kropką.
- Identyfikator zadania umieszczaj w tytule jako drugi tag. Nie powtarzaj go w treści. Pomiń drugi tag, jeśli nie ma ustalonego identyfikatora.
- Rozwinięcie dodaj tylko dla istotnego uzasadnienia lub ograniczenia. Oddziel je pustą linią, wyjaśniaj w nim „dlaczego”, a nie „co”, i zawijaj wiersze na 72 znakach.
- Nie wymagaj prefiksów Conventional Commits. Jeśli projekt automatyzuje changelog lub wersjonowanie na podstawie commitów, stosuj format wymagany przez projekt.
- Nie oznaczaj udziału agenta AI w commitach i PR: nie dodawaj trailera `Co-Authored-By` ani dopisków o AI i nie pozwól narzędziu dodać ich automatycznie. Oznaczaj go tylko wtedy, gdy wskazuje tak opis projektu lub instrukcja użytkownika.

```text
[api][TASK-142] Add order cancellation endpoint
[client][TASK-142] Add order cancellation button
[admin][ITER-04] Show cancellation history
[api] Fix invoice date validation
```

## Procedura przygotowania commitów

1. Sprawdź obowiązujące instrukcje, branch, status, staged diff, unstaged diff i istotne pliki untracked.
2. Zidentyfikuj zmiany istniejące przed zadaniem. Uwzględnij staging przygotowany przez użytkownika.
3. Ustal logiczne grupy i ich kolejność. Wykonaj podział bez zatwierdzania planu.
4. Upewnij się, że wykonano kontrole wymagane przed commitem.
5. Dodawaj jawnie wybrane pliki lub fragmenty. Nie stosuj bezrefleksyjnie `git add .` ani `git add -A` dla całego repozytorium.
6. Przejrzyj staged diff: cel, obszar, kompletność, przypadkowe pliki, dane wrażliwe i zgodność wiadomości.
7. Utwórz commit i zweryfikuj jego zawartość oraz pozostały status.
8. Raportuj krótko utworzone SHA i tytuły, istotną weryfikację, ograniczenia i pozostawione zmiany. Odróżniaj commit lokalny od opublikowanego.

## Branche i PR

- Pracuj na branchu roboczym. Jeśli zadanie zastanie zmiany na gałęzi głównej, zachowaj je i utwórz odpowiedni branch, jeśli jest to możliwe bez ryzyka utraty pracy.
- Nazwa brancha: `<type>/<task-id>-<short-description>`, np. `feat/TASK-142-order-cancellation`. Typy: `feat`, `fix`, `refactor`, `chore`, `docs`. Opis po angielsku, małymi literami, słowa oddzielone myślnikami. Bez identyfikatora zadania: `fix/invoice-date-validation`. Konwencja projektu ma pierwszeństwo.
- Branch może odpowiadać zadaniu lub iteracji. Nie twórz dodatkowych poziomów branchy bez potrzeby.
- PR obejmuje jedno spójne zadanie lub przyrost; nie musi obejmować całej iteracji. Małe commity nie usprawiedliwiają nadmiernego zakresu PR.
- Opis PR przedstawia problem, wynikające zachowanie, istotne decyzje, weryfikację i ograniczenia. Nie zastępuj go transkrypcją pracy agenta.

## Porządkowanie historii i integracja

1. Przed integracją zaktualizuj branch względem gałęzi docelowej. Branch niewspółdzielony przenieś przez rebase na aktualną gałąź docelową. Branch współdzielony aktualizuj przez merge gałęzi docelowej albo po uzgodnieniu ze współpracownikami.
2. Integruj PR przez merge commit zachowujący commity oraz granicę zadania, również gdy możliwy byłby fast-forward (`--no-ff` przy integracji lokalnej). Rebase przed merge i merge commit dają historię czytelną jak liniowa, z zachowaną granicą zadania.
3. Tytuł merge commita: `Merge TASK-142: Order cancellation`. Bez identyfikatora zadania użyj opisu zadania, np. `Merge: Invoice date validation`.
4. Nie stosuj domyślnie squash merge ani rebase merge. Jawna polityka projektu może określić wyjątek.
5. Przed integracją oceń spójność, kolejność i wartość commitów. Nie zakładaj, że historia jest poprawna dlatego, że przygotował ją agent AI.
6. Zachowaj logiczne kroki. Poprawki robocze tego samego kroku połącz, jeśli branch nie jest współdzielony.
7. Pełny squash PR jest świadomym wyjątkiem: może mieć sens dla jednej małej zmiany, której commity są wyłącznie kolejnymi próbami jej naprawy. Nie wybieraj go tylko dla uproszczenia grafu.
8. Po zmianie historii lub rozwiązaniu konfliktów ponownie zweryfikuj wynik w zakresie adekwatnym do zmiany.
9. Wykonaj merge, gdy spełnione są wszystkie warunki integracji:
   - przegląd zatwierdził aktualny commit brancha;
   - kontrole wymagane przed integracją są zielone dla tego samego commita;
   - branch jest aktualny względem gałęzi docelowej;
   - docelowy branch jest właściwy dla zadania.

   Niespełniony warunek blokuje merge. Usuń przyczynę i sprawdź warunki ponownie; nie omijaj ich.

## Usuwanie branchy

Po poprawnej integracji usuń właściwy branch roboczy lokalnie i zdalnie. Najpierw potwierdź integrację, brak nieprzeniesionych commitów, brak niezapisanej pracy oraz to, że branch nie jest potrzebny innemu zadaniu, worktree lub współpracownikowi.

Nie obchodź błędu bezpiecznego usuwania przez wymuszone usunięcie bez wyjaśnienia przyczyny.

## Kryteria zakończenia

- Commity mają pojedynczy cel i właściwy obszar.
- Commity przeznaczone do integracji nie zostawiają uszkodzonego stanu albo mają jawnie opisany wyjątek.
- Wiadomości są krótkie, konkretne, zapisane w simple English i mieszczą się w limicie długości.
- Zastosowano ustalone identyfikatory i konwencję nazw branchy.
- Powiązane testy i dokumentacja są uwzględnione.
- Nie dołączono niepowiązanych zmian, sekretów ani cudzej pracy poza zleceniem; hooki nie zostały ominięte.
- Branch był aktualny względem gałęzi docelowej, a integracja zachowuje logiczną historię i granicę PR, chyba że uzgodniono wyjątek.
- Operacje zdalne, przepisywanie historii i usuwanie branchy mieszczą się w zakresie autonomii; merge nastąpił po spełnieniu wszystkich warunków integracji.
