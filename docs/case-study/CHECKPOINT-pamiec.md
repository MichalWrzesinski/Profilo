# Checkpoint: retrospektywa z pamięci agenta

Stan na 2026-11-15, po scaleniu TASK-015 (PR #29). Ostatni commit na `main`: `90c1c02`.

## Oznaczenia pewności

- **[pewne – widzę to w kontekście]**: przebieg mam w bieżącym kontekście rozmowy albo sprawdziłem go teraz w repozytorium (`git log`, pliki).
- **[ze streszczenia]**: wiem to tylko ze streszczenia, które powstało przy kompaktowaniu kontekstu. Szczegóły i kolejność mogą być uproszczone.
- **[niepewne]**: wnioskuję lub kojarzę, ale nie mam na to dowodu.
- **„brak danych”**: nie pamiętam i nie zgaduję.

## Kompaktowanie kontekstu

- Widzę **jedno** kompaktowanie. Bieżący kontekst zaczyna się od streszczenia wcześniejszej rozmowy, która „wyczerpała kontekst”. [pewne – widzę to w kontekście]
- Streszczenie opisuje sesję od TASK-006 do TASK-012. O TASK-001–005 i o planie iteracji mówi tylko pośrednio. Mogło więc być wcześniejsze kompaktowanie albo osobna sesja, ale tego nie wiem. [niepewne]
- Łączna liczba kompaktowań: przynajmniej 1. Dokładnej liczby nie znam (brak danych).

## Źródła, które teraz widzę

- **Merge PR według `git log`:** #1 i #2 (dokumentacja i plan, 2026-11-09), #3 TASK-001 (11-09), #4 TASK-002 (11-10), #14 TASK-003 (11-10), #15 aktualizacje zależności (11-10), #18 TASK-004, #19 TASK-005, #20 TASK-006, #21 TASK-007, #22 TASK-008 (wszystkie 11-10), #23 TASK-009, #24 TASK-010, #25 TASK-011, #26 TASK-012 (wszystkie 11-14), #27 TASK-013, #28 TASK-014, #29 TASK-015 (wszystkie 11-15). [pewne – widzę to w kontekście]
- **Liczba commitów w gałęzi:** PR #26: 6, #27: 9, #28: 9, #29: 11. [pewne – widzę to w kontekście]
- **Brakujące numery PR** (5–13, 16, 17): nie wiem, co to było. Mogły to być PR-y zamknięte bez scalenia albo od Dependabota (brak danych).

---

## ITER-00: Foundation (TASK-001, TASK-002, TASK-003)

- **Iteracja / data / commity:** TASK-001 scalone 2026-11-09 (PR #3), TASK-002 2026-11-10 (PR #4), TASK-003 2026-11-10 (PR #14). [pewne – widzę to w kontekście]
- **Co zrobiono:**
  - Szkielet aplikacji (FastAPI, Next.js, Docker Compose, Caddy, Makefile).
  - CI z wymaganym zadaniem `check`.
  - Konfiguracja serwera i automatycznego wdrożenia (`infra/server/`). [ze streszczenia + pliki w repozytorium]
- **Problemy:** brak danych.
- **Decyzje agenta:** brak danych o przebiegu. Widzę tylko wynik w repozytorium:
  - akcje przypięte przez SHA, obrazy przez digest;
  - zależności nowsze niż 2 tygodnie są zakazane.

  Nie pamiętam, czy była to moja decyzja, czy wymóg standardów. [niepewne]
- **Udział człowieka:**
  - TASK-003 ma status **BLOCKED**: czeka na serwer, DNS, dostęp SSH i sekrety Brevo od użytkownika. [ze streszczenia]
  - Szczegółów rozmowy o tym nie mam (brak danych).
- **Co pomogło:** brak danych.
- **Co przeszkadzało:** brakujące dane infrastrukturalne, które musi dostarczyć człowiek. Przez to staging nie istnieje do dziś, a później blokowało to weryfikację scenariuszy „na stagingu” (patrz TASK-013). [ze streszczenia + pewne dla skutków w TASK-013]
- **Rola:** DevOps, PO (dostarczenie zasobów).

## ITER-01: First page online (TASK-004 – TASK-007)

- **Iteracja / data / commity:** wszystkie cztery zadania scalone 2026-11-10 (PR #18–#21). [pewne – widzę to w kontekście]
- **Co zrobiono:**
  - Rejestracja, logowanie, odświeżanie sesji (JWT w pamięci oraz rotowany refresh token w ciasteczku).
  - Potwierdzenie e-maila przez Mailpit i Celery.
  - Krok 1 kreatora (nick).
  - Publikacja jako niezmienny snapshot (ADR 0002) i minimalna strona publiczna. [ze streszczenia]
- **Problemy:**
  - [ze streszczenia]
    - Publiczny e-mail nie był kodowany w `mailto:`. Poprawka: `mailtoHref`.
    - Formularze wysłane przed hydratacją wkładały hasło do URL. Poprawka: `method="post"` i znacznik hydratacji `data-hydrated`.
    - Zasady nicka są w dwóch miejscach (API i klient). Rozwiązanie: wspólne przypadki testowe w `docs/api/nick-cases.json`.
  - Nie pamiętam, w którym zadaniu wystąpił każdy z tych problemów ani ile było prób. [niepewne]
- **Decyzje agenta:**
  - Nicki w zapytaniach są porównywane bez względu na wielkość liter (citext), a strona przekierowuje na nick kanoniczny. [ze streszczenia]
  - Alternatyw i uzasadnień nie pamiętam (brak danych).
- **Udział człowieka:** polecenia „Zaczynaj TASK-006” i „Zaczynaj TASK-007”. Innych korekt nie pamiętam. [ze streszczenia]
- **Co pomogło:** brak danych.
- **Co przeszkadzało:** brak danych.
- **Rola:** Dev, QA (bezpieczeństwo formularzy).

## ITER-02: Complete content (TASK-008 – TASK-011)

- **Iteracja / data / commity:** TASK-008 scalone 2026-11-10 (PR #22). TASK-009, TASK-010 i TASK-011 scalone 2026-11-14 (PR #23–#25). [pewne – widzę to w kontekście]
- **Co zrobiono:**
  - Edytor z autozapisem.
  - Linki z sortowaniem przez przeciąganie (dnd-kit).
  - Zdjęcie profilowe i tło z kadrowaniem i wariantami WebP.
  - Podgląd na żywo w iframe `/podglad` zasilany przez `postMessage`.
  - Kroki 3 i 4 kreatora.
  - Testy E2E w Playwright. [ze streszczenia]
- **Problemy:** [ze streszczenia]
  - Wyścigi autozapisu: utrata zmiany przy wychodzeniu, błąd 422 dla pola edytowanego w trakcie zapisu, publikacja nadpisująca nowszą wersję, operacje na linkach ścigające się z autozapisem. Rozwiązanie: kolejka `exclusive` i `settle`.
  - Normalizacja URL dała się obejść przez zamianę wielkości liter `İ`. Rozwiązanie: URL budowany od nowa z rozłożonych części.
  - Bomby dekompresyjne w obrazach. Rozwiązanie: limit 24 Mpx, osobna pula wątków, dekodowanie w trybie draft.
  - Wyścig przy czyszczeniu obrazów mógł usunąć świeżo wgrany plik. Rozwiązanie: czyszczenie pod blokadą przed commitem.
  - Po nieudanym uploadzie zostawały osierocone pliki.
  - Zadanie e2e w CI nie miało prawa zapisu do checkoutu (kontener działa jako uid 1000). Rozwiązanie: `chmod` w CI.
  - Serwer deweloperski Next.js blokował origin `caddy`. Rozwiązanie: `allowedDevOrigins`.
  - Narzędzia testowe:
    - reguły lintera React Compiler (ref czytany w renderze, mutacja kontekstu);
    - fałszywe timery opóźniały pasywne efekty;
    - `mockFetch` wymaga absolutnych URL;
    - gitleaks zgłaszał fałszywy alarm na testowym haśle.
  - Liczby prób dla poszczególnych problemów nie pamiętam (brak danych). Część znalazły recenzje subagentów. [niepewne, które dokładnie]
- **Decyzje agenta:** [ze streszczenia]
  - `has_unpublished_changes` porównuje numery wersji zamiast zegarów (poprawka ADR 0002).
  - Content-Security-Policy `frame-ancestors 'self'` wyłącznie dla `/podglad`.
  - Obrazy szkicu tylko z tokenem, wyświetlane przez blob URL (`OwnerImage`).
  - Alternatyw nie pamiętam.
- **Udział człowieka:** [ze streszczenia]
  - Polecenia rozpoczęcia zadań.
  - „Try again” po tym, jak subagent recenzujący trafił na limit użycia.
  - Uwaga, że AGENTS.md zabrania przypisywania autorstwa AI. Wcześniejsze commity miały błędnie stopkę Co-Authored-By. Od TASK-010 jej nie dodaję. Historii nie przepisywano.
- **Co pomogło:** [niepewne]
  - recenzje subagentów według `code-review.md` (znajdowały wyścigi i luki);
  - testy E2E na prawdziwym stosie;
  - Mailpit.
- **Co przeszkadzało:** [ze streszczenia]
  - Sprzeczność między instrukcją systemową harnessu (dodawać stopkę AI) a AGENTS.md (nie dodawać).
  - Ograniczenia ekosystemu: ESLint zostaje na wersji 9 przez wtyczki `eslint-config-next`, osobne TASK-025 i TASK-026.
- **Rola:** Dev, QA, DevOps (CI), PM (zasady commitów).

## ITER-03: Look and sharing (TASK-012 – TASK-014)

- **Iteracja / data / commity:** TASK-012 scalone 2026-11-14 (PR #26, 6 commitów). TASK-013 scalone 2026-11-15 (PR #27, 9 commitów). TASK-014 scalone 2026-11-15 (PR #28, 9 commitów). [pewne – widzę to w kontekście]
- **Co zrobiono:**
  - Układy Dzielony i Wizytówka, 8 kolorów przewodnich, krok 2 kreatora, testy dostępności axe i kontrastu na pikselach. [ze streszczenia]
  - Metadane SEO i Open Graph z kartą 1200×630 generowaną w API, `robots.txt`, `sitemap.xml`, `noindex` dla panelu. [pewne]
  - Ekran „Gotowe!”, okno „Udostępnij” i kod QR (PNG 1024 px i SVG). [pewne]
- **Problemy:**
  - TASK-012 [ze streszczenia]:
    - `accent: null` dawał 500 zamiast 422;
    - układ Wizytówka przewijał się w bok przy 320 px (poprawka w systemie projektowym);
    - historię gałęzi trzeba było przebudować (wymuszony push).
  - TASK-013 [pewne]:
    1. Czcionka do karty: obrazy Pillow nie mają czcionki z polskimi znakami. Zapytałem użytkownika i pobrałem Plus Jakarta Sans (OFL).
    2. Kolizja nazwy: funkcja i moduł `og_image`. Naprawione za 1 razem.
    3. Wersjonowanie URL karty znacznikiem czasu w sekundach: dwie publikacje w tej samej sekundzie dawały ten sam URL (test to wyłapał). Zmienione na `draft_version`.
    4. Hook pre-commit sortował importy inaczej niż kontener, bo w katalogu tymczasowym brak `tests/`. Poprawka: `known-first-party = ["app", "tests"]`.
    5. Pierwsza próba utworzenia PR odrzucona przez klasyfikator: treść miała stopkę „Generated with Claude Code”, sprzeczną z AGENTS.md. Za drugim razem bez stopki.
    6. Recenzja wskazała:
       - trzymanie połączenia z bazą podczas renderowania (ryzyko wyczerpania puli);
       - zbyt szerokie `Allow` w `robots.txt`;
       - brak testu karty zablokowanej strony.

       Poprawione w 1 rundzie.
  - TASK-014 [pewne]:
    1. Kontrakt OpenAPI miał już ścieżkę `/me/profile/qr` z innym domyślnym formatem i nazwą pliku. Dopisałem duplikat i lint wykrył zduplikowany klucz YAML. Dopasowałem kod do istniejącego kontraktu.
    2. Pokrycie gałęzi spadło do 94,6% (próg 95%). Dopisałem testy `ShareDialog`.
    3. `mockFetch` z relatywnym URL (znana pułapka) wymagał 2 poprawek w testach.
    4. Serwer deweloperski miał nieaktualny stan modułów (500). Pomógł restart.
    5. Schowek był zablokowany w panelu przeglądarki. Dodałem awaryjne `execCommand`.
    6. Pasek edytora wychodził poza ekran na telefonie, także przed tym zadaniem. Poprawiony pasek. Reszta przewijania przy 320 px wydzielona jako osobne zadanie.
    7. Recenzja wskazała: fokus znikający z okna przy wyłączonym przycisku, efekt zależny od inline `onClose`, kod QR dla zablokowanej strony. Poprawione w 1 rundzie.
- **Decyzje agenta:** [pewne dla TASK-013 i TASK-014]
  - Jedna generowana karta OG dla każdej strony zamiast samego avatara w JPEG, który przewidywała architektura. Alternatywa: wariant JPEG avatara z ponownym przetworzeniem istniejących zdjęć. Uzasadnienie: kwadrat źle się przycina w podglądach 1.91:1, a karta niesie imię i nagłówek.
  - Karta renderowana w API (Pillow, już zależność). Alternatywa: `next/og` w kliencie (Satori nie obsługuje WebP i domyślnie nie ma polskich znaków).
  - Cache karty w Valkey według wersji szkicu, limit 60 renderów na minutę na IP.
  - Sitemap budowany per żądanie z endpointu API, maksymalnie 50 000 adresów.
  - Prywatne strony z `noindex` dzięki podziałowi `layout.tsx` (serwer) i `Shell.tsx` (klient), zamiast blokady w `robots.txt`, która ukryłaby `noindex`.
  - Lighthouse lokalnie na produkcyjnym obrazie, bo stagingu brak (scenariusz 2 TASK-013 „częściowo”).
  - QR: segno, poziom korekcji M, PNG rysowany moduł po module do dokładnie 1024 px zamiast skalowania; kod dostępny także dla ukrytej strony, ale nie dla zablokowanej.
- **Udział człowieka:** [pewne dla TASK-013 i TASK-014]
  - Zgoda na pobranie czcionki z github.com/google/fonts. Zapytałem, bo pobieranie plików wymaga zgody.
  - Uruchomienie karty z zadaniem o przewijaniu przy 320 px. Sesja nie wystartowała, bo trzeba zaufać repozytorium.
  - Przy TASK-012 zgoda na wymuszony push („Allow force-push”). [ze streszczenia]
- **Co pomogło:** [pewne]
  - Makieta `screens.html#published`, odtworzona prawie 1:1.
  - `docs/api/openapi.yaml` i `make contract`, które wyłapały rozjazd.
  - Pułapki w AGENTS.md (restart klienta, `mockFetch`).
  - `BarcodeDetector` w przeglądarce do sprawdzenia, czy QR się skanuje.
  - Testy wykrywające realne błędy (wersjonowanie URL).
- **Co przeszkadzało:** [pewne]
  - Niezgodność `architecture.md` („JPEG fallback for OG”) z tym, co miało sens.
  - Kontrakt OpenAPI wyprzedzał implementację i nie było to widoczne w zadaniu.
  - PUB-BR-12 mówi „panel oferuje QR”, a zadanie mówi „menu w edytorze”: niejasne, gdzie ma być QR.
  - Scenariusze wymagające stagingu, którego nie ma.
- **Rola:** Dev, UX (umiejscowienie QR, układ na telefonie), CTO (architektura OG), DevOps (staging), PO (PUB-BR-12).

## ITER-04: Account management, w toku (TASK-015 zrobione; TASK-016 – TASK-018 przed nami)

- **Iteracja / data / commity:** TASK-015 scalone 2026-11-15 (PR #29, 11 commitów). [pewne]
- **Co zrobiono:** reset hasła. Żądanie zawsze zwraca 202, a wyszukanie konta i wysyłka e-maila dzieją się w tle po odpowiedzi. Link jest ważny 1 h i jednorazowy. Po resecie wszystkie inne sesje są kończone natychmiast, także tokeny dostępu. Do tego e-mail bezpieczeństwa, strony `/nie-pamietam-hasla` i `/nowe-haslo` oraz test E2E przez Mailpit. [pewne]
- **Problemy:** [pewne]
  1. Kontrakt mówił 204, a scenariusz 1 wymaga zalogowania. Zmieniłem na 200 z sesją.
  2. Tokeny dostępu (JWT, 15 min) przetrwałyby reset. Pierwsza wersja porównywała w pełnych sekundach, co przepuszczało token z tej samej sekundy. Druga wersja: ułamkowe `iat` z tolerancją 1 ms.
  3. Ryzyko ujawnienia istnienia konta przez czas odpowiedzi. Przeniosłem pracę do zadania w tle.
  4. Test długości życia tokenu: zegar bazy kontra zegar Pythona. Poluzowana asercja.
  5. E2E nie dostał e-maila, bo worker Celery działał na starym kodzie (`KeyError` szablonu). Restart workera; pułapka dopisana do AGENTS.md.
  6. `/nowe-haslo` miało `noindex` bez `nofollow`, więc test E2E dla stron prywatnych nie pasował. Usunąłem stronę z tej listy.
  7. Recenzja bezpieczeństwa, runda 1:
     - **blocker:** wyścig rotacji refresh tokenu z resetem pozwalał skradzionej sesji przetrwać;
     - stempel czasu brany przed haszowaniem hasła;
     - token w logach Caddy;
     - token w pasku adresu;
     - zużycie limitów przez IPv6 i brak dziennego limitu e-maili.

     Wszystko poprawione. Do wyścigu dopisałem test współbieżności i sprawdziłem, że bez poprawki nie przechodzi.
  8. Runda 2: dzienny limit dało się wyczerpać zmyślonymi adresami. Poprawka: limit liczony tylko dla istniejących kont.
- **Decyzje agenta:** [pewne]
  - Reset loguje i zwraca sesję.
  - Reset potwierdza niepotwierdzony e-mail.
  - Limit na adres: nadmiarowe prośby pomijane po cichu zamiast 429, żeby nie zdradzać, że ktoś pytał o ten adres.
  - Zadanie w tle FastAPI zamiast Celery: prostsze, ten sam efekt czasowy.
  - Kolejność blokad: konto, potem token.
  - Akceptowane ryzyko CSRF logowania na `/confirm` (takie samo jak w `/auth/login`).
- **Udział człowieka:** tylko polecenie rozpoczęcia zadania. Bez korekt. [pewne]
- **Co pomogło:** [pewne]
  - ACC-BR-7 i scenariusze w zadaniu (jasne kryteria).
  - Gotowe tabele `one_time_tokens` i `password_changed_at` w modelu.
  - Subagent z przeglądem bezpieczeństwa (znalazł prawdziwy blocker).
  - Mailpit i E2E.
- **Co przeszkadzało:** [pewne]
  - Kontrakt (204) sprzeczny ze scenariuszem (zalogowany po resecie).
  - Standardy nie mówią o kolejności blokad ani o ochronie przed ujawnianiem kont przez czas odpowiedzi; trzeba to było wyprowadzić samemu.
  - Worker Celery bez przeładowania kodu (znane, ale łatwe do przeoczenia).
- **Rola:** Dev, QA/Security, CTO (model sesji), PO (sprzeczność kontrakt–scenariusz).

---

## Otwarte sprawy, o których pamiętam

- TASK-003 (staging): BLOCKED, czeka na serwer, DNS, SSH i Brevo. [ze streszczenia]
- Adres do zgłaszania nadużyć `naduzycia@profilo.pl` to placeholder do czasu, aż poda go użytkownik. [ze streszczenia; widzę go w `client/src/lib/publicProfile.ts`]
- Stare commity na `main` mają stopkę AI. Historii nie przepisywano bez decyzji użytkownika. [ze streszczenia]
- W lokalnej bazie zostały konta testowe recenzentów i E2E. [ze streszczenia; z tej sesji: `qr-33963@example.pl`]
- Zadanie „przewijanie edytora przy 320 px” czeka na zaufanie repozytorium w sesji pobocznej. [pewne]
- Scenariusz 2 TASK-013 (Lighthouse na stagingu) do powtórzenia, gdy staging powstanie. [pewne]
- Na karcie OG nazwy pisane od prawej do lewej i emoji wyświetlają się źle (brak raqm), co jest znanym ograniczeniem. [pewne]
