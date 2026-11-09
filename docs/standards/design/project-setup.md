# Standard zakładania projektu dla agentów AI

Wersja: 1.0.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard na końcu etapu projektowania nowej aplikacji, po analizie produktu, projektowaniu wyglądu i doborze technologii. Dokument określa, jak założyć repozytorium z dokumentacją, standardami i ustawieniami tak, aby development miał od pierwszego zadania stały dostęp i mógł pracować bez udziału człowieka.

Szkielet kodu, środowisko lokalne i CI nie należą do tego etapu. Są pierwszym zadaniem developmentu, w iteracji 0.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasady nadrzędne

- **Jak najmniej pracy człowieka.** Wszystkie ustawienia wykonuje agent. Czynności, które wymagają człowieka, są zebrane w jednym kroku i wykonywane jednorazowo.
- **Ustawienia jako kod.** Wszystkie ustawienia repozytorium są zapisane w skrypcie w repozytorium, który można uruchomić ponownie z tym samym wynikiem.
- **Ograniczone uprawnienia w pracy.** Po założeniu projektu agent pracuje z uprawnieniami, które nie pozwalają zmieniać ustawień repozytorium ani zatwierdzać wdrożeń produkcyjnych.

## Konto agenta

Agent pracuje na osobnym koncie GitHub, np. `twoja-nazwa-bot`. Dzięki temu zabezpieczenia działają technicznie, a nie tylko jako zasady:

- konto agenta ma w repozytorium rolę zapisu (`Write`): może tworzyć branche, commity i PR, uruchamiać workflow i wykonywać merge;
- nie ma roli administratora, więc nie może zmienić ochrony branchy ani środowisk;
- wdrożenie produkcyjne uruchomione przez agenta zatwierdza użytkownik, a GitHub nie pozwala na zatwierdzenie przez konto, które je uruchomiło.

### Przygotowanie jednorazowe

Wykonuje je użytkownik raz, dla wszystkich przyszłych projektów:

1. założenie konta GitHub dla agenta;
2. utworzenie tokenu dostępu dla tego konta, z uprawnieniami do repozytoriów, PR i workflow;
3. zapisanie tokenu w środowisku agenta, np. jako zmienna środowiskowa lub w menedżerze sekretów.

Agent przygotowuje dokładną instrukcję tych kroków, gdy konto jeszcze nie istnieje.

### Tryb bez konta agenta

Jeśli użytkownik nie chce osobnego konta, agent pracuje na koncie użytkownika. Wtedy:

- zasady zakazujące zmiany ustawień repozytorium obowiązują, ale nie są wymuszone technicznie;
- wdrożenie produkcyjne uruchamia wyłącznie użytkownik w GitHub Actions; agent podaje tylko link do workflow.

Zapisz wybrany tryb w `AGENTS.md`, jako nadpisanie standardu wdrożeń, jeśli dotyczy.

## Kroki założenia projektu

### 1. Repozytorium

- Utwórz repozytorium prywatne na osobistym koncie GitHub użytkownika, chyba że opis projektu wskazuje inne konto lub organizację.
- Nazwa repozytorium pochodzi od nazwy produktu, małymi literami, ze słowami oddzielonymi myślnikami, np. `wallet`.

### 2. Zawartość startowa

```
README.md                  nazwa, opis, odesłanie do dokumentacji; komendy uzupełnia iteracja 0
AGENTS.md                  instrukcje dla agentów z profilem technicznym
CLAUDE.md                  tylko odesłanie do AGENTS.md
.gitignore
.editorconfig
.github/
└── pull_request_template.md
docs/
├── product/               z analizy produktu
├── design/                z projektowania wyglądu
├── api/openapi.yaml       kontrakt API
├── architecture.md        moduły, model danych, dane wrażliwe
├── decisions/             decyzje z doboru technologii
├── standards/             kopia standardów z numerem wersji
└── tasks/                 pusty; zadania tworzy planowanie
scripts/
└── setup-github.sh        ustawienia repozytorium jako kod
```

- `AGENTS.md` zawiera profil techniczny z doboru technologii, odesłanie do `docs/standards/` i nadpisania standardów obowiązujące w projekcie.
- Plik licencji dodaj tylko wtedy, gdy projekt ma być publiczny.

### 3. Standardy w repozytorium

- Skopiuj obowiązujące standardy do `docs/standards/`, z zachowaniem podziału na katalogi, np. `development/`, `planning/`, `design/`, oraz z informacją o wersji i dacie kopii.
- Agent stosuje standardy z repozytorium, nie z innej lokalizacji. Dzięki temu każdy agent, także działający w chmurze, ma do nich dostęp, a projekt ma stałą wersję zasad.
- Aktualizacja standardów w projekcie to osobne zadanie.

### 4. Ustawienia repozytorium

Zapisz ustawienia w `scripts/setup-github.sh`, korzystając z `gh`, i uruchom skrypt z uprawnieniami użytkownika. Użytkownik zatwierdza uruchomienie raz.

- **Integracja PR:** dozwolony tylko merge commit, zgodnie ze standardem pracy z Git; wyłączony squash i rebase merge; automatyczne usuwanie branchy po merge.
- **Ochrona gałęzi głównej:**
  - zmiany tylko przez PR;
  - bez wymaganej akceptacji człowieka, ponieważ przegląd wykonuje recenzent subagent;
  - wymagana kontrola CI o ustalonej nazwie, np. `check`. Iteracja 0 tworzy w CI zadanie o tej nazwie, więc ustawienie nie wymaga późniejszych zmian;
  - zakaz force push i usuwania gałęzi.
- **Środowiska:**
  - `staging` bez wymaganego zatwierdzenia;
  - `production` z wymaganym zatwierdzeniem przez użytkownika i blokadą zatwierdzenia przez osobę, która uruchomiła wdrożenie.
- **Dostęp agenta:** zaproszenie konta agenta z rolą `Write`. Agent przyjmuje zaproszenie swoim tokenem.
- **Bezpieczeństwo:** włączone alerty o podatnych zależnościach oraz skanowanie sekretów, jeśli jest dostępne dla repozytorium.

### 5. Uprawnienia narzędzia agenta

Zapisz w repozytorium ustawienia narzędzia agenta, np. `.claude/settings.json`, aby agent nie pytał o zgodę na czynności, na które pozwalają standardy:

- **dozwolone bez pytania:** komendy projektu, np. `make`, `docker compose`, operacje `git` na branchach roboczych, `gh pr`, `gh run`, narzędzia ekosystemu projektu;
- **zabronione:** zatwierdzanie wdrożeń, zmiana ustawień repozytorium, polecenia usuwające dane poza katalogiem projektu.

### 6. Zapis i publikacja

- Utwórz pierwszy commit z zawartością startową bezpośrednio na gałęzi głównej, przed włączeniem jej ochrony, i opublikuj go.
- Następnie uruchom skrypt ustawień repozytorium.

## Przejście dalej

Po założeniu projektu agent bez czekania:

1. uruchamia sprawdzenie gotowości według standardu bramki wejścia;
2. jeśli nie ma braków blokujących, planuje zadania według standardu planowania, zaczynając od iteracji 0: szkielet aplikacji, środowisko lokalne, CI z kontrolą o ustalonej nazwie, pusta aplikacja na stagingu.

Od tego momentu użytkownik nie musi nic robić aż do zgłoszenia gotowości pierwszej wersji do wdrożenia.

## Kryteria zakończenia

- Repozytorium jest prywatne, na wskazanym koncie, z zawartością startową i dokumentacją z etapu projektowania.
- Standardy są skopiowane do `docs/standards/` z wersją; `AGENTS.md` zawiera profil techniczny i odesłanie do standardów.
- Ustawienia repozytorium są zapisane w skrypcie i zastosowane: merge commit, ochrona gałęzi głównej z wymaganą kontrolą CI, środowiska `staging` i `production`, alerty bezpieczeństwa.
- Agent ma dostęp z rolą `Write` na osobnym koncie albo zastosowano tryb bez konta agenta.
- Ustawienia narzędzia agenta pozwalają na pracę bez pytań w granicach standardów.
- Człowiek wykonał najwyżej jednorazowe przygotowanie konta agenta i jedno zatwierdzenie uruchomienia skryptu ustawień.
- Agent przeszedł do bramki wejścia i planowania bez czekania na polecenie.
