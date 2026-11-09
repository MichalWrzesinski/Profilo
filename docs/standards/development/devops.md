# Standard infrastruktury (DevOps) dla agentów AI

Wersja: 1.4.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard przy tworzeniu i zmianie środowiska lokalnego, obrazów Docker, CI, konfiguracji środowisk, infrastruktury i automatycznych aktualizacji zależności. Dokument określa, jak aplikacja jest uruchamiana, budowana i sprawdzana oraz jak przygotować ją do działania u dowolnego dostawcy.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasady nadrzędne

- **Jedna komenda.** Uruchomienie, testy i kontrole wykonuje się jedną komendą, taką samą dla człowieka, agenta i CI.
- **Wszystko w repozytorium.** Konfiguracja środowisk, CI i serwerów jest zapisana w repozytorium. Nie wprowadzaj ręcznych zmian na serwerach.
- **Jeden obraz.** Obraz aplikacji budujesz raz i używasz tego samego w każdym środowisku. Środowiska różnią się tylko konfiguracją.
- **Przenośność.** Aplikacja działa u dowolnego dostawcy kontenerów, od pojedynczego serwera po chmurę, np. AWS, bez zmian w kodzie.

## Przenośność

- Konfigurację przekazuj wyłącznie przez zmienne środowiskowe. Kod nie zawiera adresów, nazw hostów ani ustawień środowiska.
- Kontener aplikacji nie przechowuje stanu. Uruchomienie kolejnej kopii lub wymiana kontenera nie traci danych.
- Pliki użytkowników domyślnie zapisuj na dysku serwera, w trwałym wolumenie poza kontenerem, objętym kopiami zapasowymi.
- Zapis i odczyt plików wykonuj przez warstwę abstrakcji magazynu plików, uznaną dla frameworka, np. Flysystem w PHP. Kod nie odwołuje się bezpośrednio do ścieżek na dysku. Dzięki temu przejście na magazyn obiektów, np. S3, R2 lub usługę dostawcy hostingu, wymaga tylko zmiany konfiguracji.
- Przejdź na magazyn obiektów, gdy aplikacja działa na więcej niż jednym serwerze lub gdy wskazuje to projekt.
- Sesje, blokady i kolejki trzymaj w bazie lub cache, nie w pamięci procesu ani w plikach lokalnych.
- Korzystaj z usług standardowych, dostępnych jako usługi zarządzane u każdego dużego dostawcy: PostgreSQL, Redis lub Valkey, SMTP.
- Funkcje specyficzne dla dostawcy umieszczaj w adapterach za interfejsem. Reszta aplikacji nie zależy od dostawcy.
- Zadania cykliczne uruchamiaj jako proces lub kontener aplikacji, nie przez crona serwera.
- Hosting wskazuje projekt. Jeśli go nie wskazuje, buduj tak, aby aplikacja działała na dowolnym hostingu kontenerów, i nie wprowadzaj zależności od konkretnego dostawcy.

## Środowisko lokalne

- Całe środowisko działa w Docker Compose: aplikacja, baza, cache, kolejka i atrapy usług zewnętrznych, np. Mailpit dla poczty.
- Wspólne komendy są w `Makefile`:

| Komenda | Działanie |
|---|---|
| `make up` | Uruchamia projekt od zera po sklonowaniu: tworzy `.env` z `.env.example`, buduje obrazy, wykonuje migracje i seed |
| `make down` | Zatrzymuje środowisko |
| `make test` | Uruchamia testy |
| `make check` | Uruchamia wszystkie kontrole wymagane w CI: formater, linter, analizę statyczną, testy z pokryciem |
| `make migrate` | Wykonuje migracje |
| `make seed` | Ładuje dane demonstracyjne i konta testowe |

- Komendy w `Makefile` wywołują narzędzia projektu, np. skrypty `composer` lub `npm`. Nie powielaj w nich logiki.
- Środowisko lokalne nie wymaga instalowania niczego poza Dockerem i `make`.

## Dane testowe i konta

- `make seed` tworzy dane demonstracyjne, które pokazują główne przepływy aplikacji, oraz konto testowe dla każdej roli.
- Dane logowania kont testowych opisz w README, z zaznaczeniem, że dotyczą wyłącznie środowiska lokalnego.
- Seed jest powtarzalny: ponowne uruchomienie daje ten sam stan.
- Seed nie działa w środowisku produkcyjnym.

## Obrazy Docker

- Stosuj build wieloetapowy. Obraz produkcyjny nie zawiera narzędzi deweloperskich, zależności testowych ani kodu źródłowego zbędnego do działania.
- Przypinaj wersje obrazów bazowych, nigdy `latest`. Wybieraj obrazy oficjalne.
- Proces w kontenerze działa jako użytkownik bez uprawnień root.
- Każdy obraz ma `HEALTHCHECK` korzystający z punktu kontroli stanu aplikacji.
- Plik `.dockerignore` wyklucza z obrazu m.in. `.git`, `.env` i katalogi zależności lokalnych.
- Obraz oznaczaj identyfikatorem commita, z którego powstał. Sekretów nie umieszczaj w obrazie.

## CI

- Domyślnie stosuj GitHub Actions.
- **Na każdym PR** CI wykonuje: `make check`, audyt podatności zależności, skan sekretów, sprawdzenie zgodności API z kontraktem, jeśli projekt go ma, i build obrazu. Wymagane kontrole blokują merge.
- **Po merge do gałęzi głównej** CI buduje obraz i publikuje go w rejestrze, np. GitHub Container Registry. Opublikowany obraz jest jedynym źródłem wdrożeń.
- CI wykonuje te same komendy co środowisko lokalne, aby wynik był taki sam.
- Buforuj zależności i warstwy obrazów, aby skrócić czas CI.
- Przypinaj wersje akcji; akcje spoza GitHuba przypinaj do identyfikatora commita.
- Nadawaj workflow minimalne uprawnienia.

## Środowiska

| Środowisko | Przeznaczenie |
|---|---|
| Lokalne | Praca i testy agenta oraz człowieka |
| Staging | Sprawdzenie zmian w warunkach produkcyjnych |
| Produkcja | Użytkownicy |

- Staging ma tę samą konfigurację co produkcja, z własnymi danymi i sekretami.
- Nie kopiuj danych produkcyjnych na staging ani lokalnie. Jeśli są potrzebne, używaj danych zanonimizowanych.

## Aktualizacje zależności

- Renovate lub Dependabot otwiera PR z aktualizacjami zależności, obrazów bazowych i akcji CI.
- Aktualizacje drobne grupuj i otwieraj najwyżej raz w tygodniu. Poprawki bezpieczeństwa otwieraj od razu.
- Aktualizacja wersji głównej, np. frameworka, ma osobny PR.
- PR z aktualizacją przechodzi zwykłą drogę: kontrole, przegląd i integrację.

## Infrastruktura jako kod

- Konfiguracja środowisk jest w repozytorium, np. Compose dla stagingu i produkcji oraz skrypt przygotowania serwera.
- W większych projektach lub w chmurze opisuj infrastrukturę narzędziem infrastruktury jako kodu, np. Terraform lub OpenTofu.
- Proces przygotowania nowego serwera lub środowiska jest powtarzalny i opisany w dokumentacji technicznej.

## Kryteria zakończenia

- Projekt uruchamia się jedną komendą od zera; `make check` daje ten sam wynik lokalnie i w CI.
- Seed tworzy dane demonstracyjne i konta testowe dla każdej roli; nie działa w produkcji.
- Aplikacja nie przechowuje stanu w kontenerze, konfiguracja jest w zmiennych środowiskowych, a pliki są obsługiwane przez warstwę abstrakcji magazynu, na trwałym wolumenie objętym kopiami.
- Obrazy są wieloetapowe, z przypiętymi wersjami, bez uprawnień root, z healthcheckiem i oznaczeniem commita.
- CI blokuje merge przy niezaliczonych kontrolach i publikuje obraz po merge do gałęzi głównej.
- Aktualizacje zależności są automatyczne i przechodzą zwykłą drogę zmiany.
- Konfiguracja infrastruktury jest w repozytorium; na serwerach nie ma ręcznych zmian.
