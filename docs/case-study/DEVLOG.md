# Dziennik rozwoju (case study)

Dziennik zaczyna się od ITER-04: wpis dopisuję po każdej zakończonej iteracji, w commicie `[docs]` razem z jej ostatnim zadaniem. Wcześniejsze iteracje opisuje retrospektywa z pamięci w [CHECKPOINT-pamiec.md](CHECKPOINT-pamiec.md).

Każdy wpis ma te części:

- **Iteracja / data / commity**
- **Co zrobiono:** 1–3 zdania.
- **Problemy:** co nie zadziałało za pierwszym razem, ile było prób i jak to rozwiązano.
- **Decyzje agenta:** co zdecydowałem sam, jakie były alternatywy i dlaczego wybrałem tę.
- **Udział człowieka:** gdzie była potrzebna decyzja lub korekta i dlaczego.
- **Co pomogło:** standardy, plan, testy, narzędzia.
- **Co przeszkadzało:** niejasności, sprzeczności i brakujące informacje.
- **Rola:** PO, PM, CTO, QA, UX, Dev lub DevOps.

## ITER-04 — Account management

- **Iteracja / data / commity:** 2026-11-15. TASK-015 (PR #29, 11 commitów), TASK-016 (PR #31, 10), TASK-017 (PR #32, 5), TASK-018 (PR #33). Pośrodku osobny PR #30 z retrospektywą (CHECKPOINT-pamiec.md i nagłówkiem tego dziennika).
- **Co zrobiono:**
  - reset hasła przez e-mail;
  - zmiana hasła i trwałe usuwanie konta z 30-dniową kwarantanną nicka;
  - godzinne zadania porządkowe (niepotwierdzone konta, kwarantanny, osierocone pliki);
  - proof-of-work w formacie ALTCHA przy wielu rejestracjach z jednego IP.
- **Problemy:**
  - **Tokeny dostępu po zmianie hasła (TASK-015):** przetrwałyby zmianę hasła. Pierwsza poprawka porównywała czasy w pełnych sekundach i przepuszczała token z tej samej sekundy. Druga: ułamkowe `iat` z tolerancją 1 ms (2 próby).
  - **Czas odpowiedzi resetu zdradzał istnienie konta.** Wyszukanie konta i wysyłkę e-maila przeniosłem do zadania w tle po odpowiedzi (1 próba).
  - **Recenzje bezpieczeństwa znalazły:**
    - TASK-015 (blocker): wyścig odświeżania sesji z resetem; skradziona sesja mogła przetrwać reset. Poprawka: ustalona kolejność blokad (konto, potem token) i test współbieżności, który bez poprawki nie przechodzi.
    - TASK-016: zakleszczenie przy kliknięciu linku z e-maila w trakcie usuwania konta; karty podglądu zostawały w cache 7 dni; pliki zostawały, gdy kolejka nie działała; podwójne wysłanie okna usuwania.
    - TASK-017: przy pustej lub częściowo odtworzonej bazie zadanie usunęłoby wszystkie zdjęcia. Dodałem bezpiecznik (stop powyżej 20% „sierot”, limit 500 na przebieg) i wpis w runbooku.
    - TASK-018 (blocker): równoległe żądania omijały wyzwanie, bo licznik był odczytywany przed zwiększeniem. Do tego ważność wyzwania dało się przedłużyć, przesuwając cyfry z liczby do soli, a IPv6 nie był liczony według sieci /64.
    - Każdą recenzję zamykały 2 rundy.
  - **Środowisko:**
    - worker Celery nie przeładowuje kodu (brak nowego szablonu e-maila, `KeyError`);
    - serwer deweloperski Next zwracał 404 dla nowych tras do restartu;
    - E2E wymagało restartu workera.
  - **Build produkcyjny (TASK-018):** po scaleniu poprawek recenzji zadanie CI `check` dochodziło do 30-minutowego limitu na budowaniu obrazu produkcyjnego klienta. Na początku uznałem to za wolny runner i uruchomiłem ponownie; dopiero pytanie użytkownika („dlaczego ponad 32 minuty?”) skłoniło mnie do sprawdzenia lokalnie. Okazało się, że `next build` wisi przez cykl importów: moduł tworzący web worker był importowany przez sam worker. Serwer deweloperski i E2E tego nie pokazały. Poprawka: osobny moduł solvera (1 próba). Lekcja: przy zmianach bundlingu budować obraz produkcyjny lokalnie przed pushem.
  - **E2E i przeglądarka:**
    - wylogowanie po usunięciu konta ścigało się ze strażnikiem panelu; 2 próby, w drugiej podwójny efekt w Strict Mode;
    - `crypto.subtle` nie istnieje pod `http://caddy` (brak bezpiecznego kontekstu) i rozwiązywanie wyzwania wisiało. Rozwiązanie: SHA-256 w czystym JS i obsługa błędu workera (1 diagnoza w przeglądarce, 1 poprawka).
  - **Testy:**
    - kwarantanny przeciekały między testami API, bo `clean_state` czyścił tylko konta;
    - gitleaks uznał hasła testowe za sekrety;
    - wspólny magazyn `memory://` psuł asercje na sumach plików.
- **Decyzje agenta:**
  - **Reset i zmiana hasła zwracają nową sesję** zamiast 204 z kontraktu. Alternatywa: 204 i ponowne logowanie. Scenariusz wymaga zalogowania, a stary token i tak przestaje działać.
  - **Nadmiarowe prośby o reset dla jednego adresu są cicho pomijane** zamiast 429, żeby nie zdradzać, że ktoś pytał o ten adres.
  - **Kwarantanna nicka przy każdym usunięciu konta** (ACC-BR-10). Przy automatycznym usunięciu niepotwierdzonego konta nick zwalnia się od razu (ACC-BR-6).
  - **Blokada zadań w Valkey przy niedostępnym Valkey pomija przebieg** zamiast go wykonać, bo zadania usuwają dane.
  - **ALTCHA bez bibliotek** (kilkadziesiąt linii i brak zależności, które musiałyby mieć 2 tygodnie). Pierwsza wersja podniosła limit rejestracji na IP z 10 do 20 na godzinę. Recenzja pokazała, że bot z natywnym kodem rozwiązuje wyzwanie w milisekundach, więc limit wrócił do 10, a proof-of-work tylko podnosi koszt.
  - **Poprawkę przewijania edytora przy 320 px wydzieliłem** do osobnej sesji zamiast robić ją w ramach zadania.
- **Udział człowieka:**
  - Polecenia rozpoczęcia kolejnych zadań.
  - Prośba o DEVLOG i checkpoint (zmiana procesu).
  - Pytanie o zbyt długie CI w TASK-018: dzięki niemu znalazłem prawdziwy błąd (zawieszony build produkcyjny) zamiast ponawiać zadanie.
  - Pytanie, jak uruchomić projekt lokalnie.
  - Zaufanie repozytorium dla sesji z poprawką 320 px. Sesja nie wystartowała bez tej zgody i do dziś czeka.
  - W trakcie zadań nie było korekt merytorycznych.
- **Co pomogło:**
  - **Reguły biznesowe w `accounts.md`** (ACC-BR-6/7/9/10): jednoznaczne kryteria.
  - **Kontrakt OpenAPI i `make contract`.**
  - **Pułapki w AGENTS.md:** każdą nową dopisywałem od razu, a następne zadania z nich korzystały, np. kolejność blokad i restart workera.
  - **Recenzje subagentów z przeglądem bezpieczeństwa:** 1 blocker i kilkanaście realnych poprawek.
  - **Mailpit i E2E na prawdziwym stosie.**
  - **Ręczne uruchamianie zadań Celery** na lokalnym stosie.
- **Co przeszkadzało:**
  - Kontrakt sprzeczny ze scenariuszami: 204 przy resecie i zmianie hasła, a jednocześnie wymóg „zalogowany”.
  - Standardy nie mówią o kolejności blokad, ujawnianiu kont przez czas odpowiedzi ani o bezpiecznikach przy masowym usuwaniu danych; wszystko wyszło dopiero w recenzji.
  - Środowisko E2E na zwykłym HTTP różni się od produkcji (brak bezpiecznego kontekstu).
  - Limit rejestracji na IP nie uwzględniał zestawu E2E (budżet 9 z 10 rejestracji na godzinę).
  - Pomiary kosztu proof-of-work były niespójne (`crypto.subtle` z jednym `await` na liczbę jest wolniejszy niż synchroniczne SHA-256 w JS). Recenzja to wychwyciła.
- **Rola:**
  - Dev: wyścigi, testy, środowisko.
  - QA/Security: recenzje.
  - CTO: model sesji, kolejność blokad, bezpiecznik danych.
  - DevOps: runbook, worker, Beat, staging nadal zablokowany.
  - PO: sprzeczność kontraktu ze scenariuszem, umiejscowienie kwarantanny.
