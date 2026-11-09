# Standard kontroli jakości dla agentów AI

Wersja: 1.5.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard podczas planowania, implementacji, weryfikacji i przeglądu zmian w aplikacji. Oceniaj poprawność działania oraz kompletność względem wymagań. Samo napisanie kodu, testów lub pozytywne review nie dowodzi poprawnego działania aplikacji.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Respektuj jawne wyjątki projektu. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

Obowiązek weryfikacji nie rozszerza zakresu zadania.

## Konfiguracja projektu

Odczytaj z projektu: kryteria akceptacji, stos technologiczny, komendy kontroli, wymagania CI, środowisko testowe, dane testowe, obszary podwyższonego ryzyka oraz jawne wyjątki.

- Preferuj istniejące skrypty i komendy projektu. Nie wymyślaj wyniku niedostępnej kontroli.
- Rozróżniaj testy, analizę statyczną, kontrolę formatowania, lint, build, kontrolę kontraktów, audyt zależności pod kątem znanych podatności, skanowanie sekretów i weryfikację interfejsu. Jedna kontrola nie zastępuje pozostałych.
- Stosuj narzędzia właściwe dla języka i frameworka projektu. Konkretne narzędzia, wersje i poziomy analizy określa projekt. Jeśli ich nie określa, wybierz narzędzia powszechnie stosowane w danym ekosystemie i zapisz je w profilu technicznym projektu. Nie przenoś narzędzi ani konfiguracji z innego ekosystemu.
- Drobne uzupełnienia konfiguracji kontroli wykonuj w zakresie zadania. Brak wymaganego narzędzia lub istotną zmianę infrastruktury jakości zapisz jako propozycję nowego zadania.

## Analiza statyczna, formater i linter

- Projekt ma analizę statyczną wykrywającą błędy typów i logiki bez uruchamiania kodu, np. PHPStan dla PHP, mypy lub Pyright dla Pythona, kompilator TypeScript w trybie `strict` dla TypeScript.
- Stosuj poziom analizy określony w projekcie; jeśli go nie określa, stosuj najwyższy poziom lub tryb ścisły. Nowy i zmieniany kod nie wprowadza nowych błędów, a baseline obejmuje wyłącznie błędy istniejące przed zmianą. Podniesienie poziomu to osobne zadanie.
- Styl kodu wymuszaj automatycznie formaterem i linterem skonfigurowanymi zgodnie ze standardem stylu projektu, nie ręcznie.
- Analiza statyczna, formater i linter działają lokalnie przed commitem oraz w CI jako kontrole wymagane.

## Pokrycie kodu

- Domyślny próg pokrycia wynosi 95% w każdej przestrzeni aplikacji dotkniętej zmianą, np. backend, frontend klienta, panel administracyjny.
- Jeśli przestrzeń ma pokrycie poniżej progu, np. w projekcie istniejącym lub legacy, nowy i zmieniany kod osiąga próg, a łączne pokrycie przestrzeni nie spada.
- Wyłączenia z pomiaru, np. kod generowany, punkty wejścia, czysta konfiguracja, muszą być jawne, wąskie i uzasadnione w konfiguracji narzędzia.
- Pokrycie jest minimum, a nie celem. Test, który wykonuje kod bez sprawdzania istotnego zachowania, nie spełnia wymagania, nawet jeśli podnosi wynik.
- Gdy osiągnięcie progu jest nieuzasadnione, np. dla adaptera usługi zewnętrznej sprawdzanego testem z atrapą na poziomie wyższym, dodaj wąskie wyłączenie konkretnego pliku lub fragmentu w konfiguracji narzędzia, z uzasadnieniem w komentarzu. Recenzent ocenia wyłączenie w przeglądzie. Nie obniżaj progu.

## Planowanie i zakres kontroli

1. Przed implementacją ustal obserwowalne kryteria akceptacji oraz sposób ich sprawdzenia. Nie zastępuj specyfikacji założeniami wywnioskowanymi z gotowego kodu.
2. Dobierz kontrole do zakresu, zależności i ryzyka, także poza bezpośrednio zmienionymi plikami. Mały diff może mieć duży wpływ.
3. Zacznij od szybkich, ukierunkowanych sprawdzeń, następnie rozszerz zakres zgodnie z ryzykiem i wymaganiami projektu.
4. Przed każdym commitem wykonaj kontrole ukierunkowane na zmianę: testy dotkniętego obszaru, lint i analizę typów, a build, jeśli zmiana może go uszkodzić. Celem jest commit, który się buduje i nie psuje znanych testów. Pełny zestaw przed każdym commitem stosuj tylko wtedy, gdy projekt tak stanowi.
5. Przed oddaniem zadania do review wykonaj komplet kontroli wymaganych dla jego zakresu i ryzyka na końcowym stanie zmian. Niekompletne zadanie można przekazać jako robocze, z jawnym statusem.
6. Przed merge potwierdź aktualne wymagane kontrole CI dla końcowego commita i spełnienie kryteriów akceptacji. Znane błędy wprowadzone przez zmianę blokują gotowość do integracji.
7. Powiąż wynik z wersją kodu, zakresem i środowiskiem. Po kolejnej zmianie powtórz kontrole, na których wynik mogła wpłynąć. Nie przedstawiaj starego sukcesu jako sprawdzenia aktualnej wersji.

## Tworzenie i utrzymanie testów

- Preferuj TDD przy nowej logice biznesowej i naprawach błędów. Nie stosuj go mechanicznie do każdej zmiany.
- Przy naprawie błędu dodaj test regresyjny, jeśli jest to praktycznie wykonalne. Potwierdź, że odtwarza błąd przed poprawką i przechodzi po niej. Jeśli nie można tego sprawdzić, wskaż ograniczenie.
- Przy nowej logice testuj zachowanie wynikające z wymagań, ważne wyjątki, granice danych i uprawnienia.
- Przed zmianą kodu bez testów, np. w projekcie legacy, najpierw dodaj testy charakteryzujące, które utrwalają jego obecne zachowanie w zakresie zmiany. Dopiero potem wprowadzaj zmianę.
- Przy refaktoryzacji potwierdź zachowanie istniejącymi testami i uzupełnij istotne braki. Nie zmieniaj oczekiwanego zachowania bez podstawy w zadaniu.
- Wybieraj poziom testu według sprawdzanego ryzyka: jednostkowy dla izolowanej logiki, integracyjny dla współpracy komponentów, akceptacyjny lub E2E dla przepływu użytkownika.
- Nie twórz testów wyłącznie po to, aby odtworzyć strukturę implementacji, potwierdzić zachowanie mocków lub zwiększyć liczbę testów. Test powinien wykrywać istotną regresję.
- Dla zmian kosmetycznych i dokumentacyjnych wykonaj właściwą kontrolę, bez obowiązkowego tworzenia testów kodu.

## Budowa testu

- Jeden test sprawdza jedno zachowanie. Kilka asercji jest dopuszczalnych, jeśli opisują ten sam wynik.
- Nazwa testu opisuje zachowanie i warunek, np. `rejects_cancellation_after_shipment`, a nie nazwę testowanej metody.
- Stosuj układ Arrange–Act–Assert: przygotowanie, jedno działanie, sprawdzenie wyniku.
- Dane testowe twórz przez fabryki lub buildery z rozsądnymi wartościami domyślnymi. W teście ustawiaj jawnie tylko wartości istotne dla sprawdzanego zachowania.
- Asercje dają czytelny komunikat błędu: co oczekiwano i co otrzymano.
- Testy nie zależą od siebie ani od kolejności uruchamiania.

## Mocki, dane i środowisko testów

- Zastępuj atrapami granice systemu: usługi zewnętrzne, płatności, wysyłkę wiadomości, czas i losowość. Nie mockuj własnych klas wewnętrznych tylko po to, aby odizolować test.
- W testach integracyjnych używaj prawdziwej usługi tego samego typu co produkcja, np. bazy danych w kontenerze, zamiast zamiennika innego typu.
- Nie zastępuj istotnej integracji mockiem w celu ukrycia problemu.
- Zamiast stałych opóźnień (`sleep`) używaj sztucznego zegara albo jawnego oczekiwania na warunek.
- Zapewnij izolację, powtarzalność i kontrolę danych. Jeśli potrzebny jest rzeczywisty test integracji z usługą zewnętrzną, użyj dedykowanego środowiska testowego.

## Integralność kontroli jakości

1. Aktualizuj testy, gdy świadomie zmieniono wymagania. Uzasadnienie opieraj na kontrakcie lub kryterium akceptacji, nie wyłącznie na aktualnym zachowaniu implementacji.
2. Nie usuwaj ani nie pomijaj testów, nie osłabiaj asercji, nie obniżaj poziomu analizy ani progu pokrycia i nie rozszerzaj baseline lub wykluczeń tylko dla uzyskania zielonego wyniku.
3. Nie wyciszaj błędów i nie zmieniaj wymaganej kontroli CI na opcjonalną w celu ukrycia problemu.
4. Uzasadniony wyjątek musi mieć przyczynę merytoryczną, możliwie wąski zakres i jawny opis. Sama trudność naprawy nie jest uzasadnieniem. Nie zmieniaj obowiązującej polityki jakości w ramach zadania; zaproponuj zmianę w raporcie.
5. Nie ponawiaj niestabilnego testu do pierwszego sukcesu i nie raportuj wyłącznie tego sukcesu. Zachowaj informację o niestabilności i ustal jej znaczenie.

## Błędy wcześniejsze i blokady

- Odróżnij błąd wprowadzony przez zmianę od problemu wcześniejszego i awarii środowiska.
- Korzystaj z wiarygodnych wyników CI lub bezpiecznej weryfikacji wersji bazowej, np. w izolowanym checkout. Nie cofaj ani nie nadpisuj bieżących lub cudzych zmian dla porównania.
- Nie przypisuj błędu wersji bazowej bez dowodów. Przy braku rozstrzygnięcia oznacz przyczynę jako nieustaloną.
- Problemy wcześniejsze raportuj osobno od błędów wprowadzonych przez zmianę.
- Jeśli problem uniemożliwia ocenę zmiany, oznacz właściwą kontrolę jako zablokowaną. Kontynuuj niezależne sprawdzenia.
- Niedostępna baza, narzędzie lub przeglądarka nie dowodzi błędu kodu, ale nie pozwala deklarować sukcesu niewykonanej kontroli.

## Weryfikacja frontendu

Przy zmianach zachowania lub układu uruchom aplikację w przeglądarce, jeśli masz taką możliwość. Dobierz scenariusze do zmiany i sprawdź:

- główny przepływ użytkownika i istotne alternatywy;
- odpowiednie stany ładowania, błędu, sukcesu i pustych danych;
- istotne rozmiary ekranu i responsywność;
- podstawową obsługę klawiaturą, fokus i semantykę zmienionych elementów;
- błędy konsoli oraz nieudane lub nieprawidłowe żądania.

Dla zmienionych widoków uruchom automatyczny skaner dostępności, np. axe, jeśli projekt go ma lub można go uruchomić bez zmiany konfiguracji projektu.

Automatyzuj przede wszystkim ważne, powtarzalne scenariusze. Nie wymagaj nowego testu E2E dla każdej zmiany. Sprawdzenie buildu nie zastępuje weryfikacji interakcji, a screenshot nie dowodzi poprawności przepływu.

Bez dostępu do przeglądarki wykonaj dostępne kontrole i jawnie oznacz brak weryfikacji wizualnej oraz interakcyjnej. Nie przedstawiaj podstawowej kontroli ani automatycznego skanu dostępności jako pełnego audytu.

## Zmiany podwyższonego ryzyka

Rozszerz kontrole dla autoryzacji, izolacji danych użytkowników, płatności, obliczeń finansowych, migracji i usuwania danych, sekretów, integracji oraz zmian kontraktów API. Uwzględnij inne obszary wskazane przez projekt.

Sprawdź odpowiednio do zmiany: scenariusze negatywne, granice dostępu, zgodność wsteczną, transakcje, timeouty, retry, idempotencję, częściowe niepowodzenia i możliwość odwrócenia skutków. Dla migracji oceń wpływ na istniejące dane i sposób bezpiecznego wdrożenia; rollback nie zawsze jest możliwy.

Przy operacjach produkcyjnych o nieodwracalnych skutkach wymagana jest świadoma decyzja osoby odpowiedzialnej. Sam pozytywny wynik testów nie upoważnia do wykonania takiej operacji.

## Bezpieczeństwo środowiska weryfikacji

- Domyślnie używaj izolowanego środowiska i danych testowych. Przed potencjalnie destrukcyjną komendą potwierdź docelowe środowisko i zasoby.
- Nie uruchamiaj testów na produkcyjnych danych ani z usługami powodującymi rzeczywiste płatności, wysyłkę wiadomości lub usuwanie zasobów. Używaj sandboxów, atrap lub dedykowanych kont testowych.
- Nie ujawniaj sekretów ani danych osobowych w logach, fixture, screenshotach i raportach. Ograniczaj dane do niezbędnego zakresu.
- Nie usuwaj cudzych zasobów ani nie zatrzymuj istniejących usług podczas sprzątania. Usuń lub zatrzymaj własne zasoby tymczasowe, jeśli jest to bezpieczne.

## Koszt i pętle napraw

1. Nie powtarzaj sprawdzeń bez zmiany kodu, środowiska lub nowej przesłanki. Spełnij jednak wymagania dotyczące aktualności CI przed merge.
2. Filtruj nadmiarowe wyjście narzędzi, zachowując status zakończenia i informacje potrzebne do diagnozy. Pełne istotne logi pozostaw dostępne, bez danych wrażliwych.
3. Nie pomijaj po cichu wymaganych kontroli dla oszczędności. Jeśli brakuje czasu lub budżetu, zakończ z jawnym statusem nieukończonej weryfikacji.

## Procedura zakończenia weryfikacji

1. Przejrzyj aktualny diff i kryteria akceptacji, również pod kątem pominiętych wymagań, kontraktów i dokumentacji.
2. Zestaw każde kryterium z dowodem. Nie uznawaj deklaracji autora ani samej obecności kodu za dowód działania.
3. Oznacz kryteria zgodnie z poniższą tabelą. Dla prostego zadania wystarczy krótka lista; rozbudowana tabela nie jest obowiązkowa.

| Status | Znaczenie |
|---|---|
| Spełnione | Istnieje wystarczający dowód właściwego zachowania w wymaganym zakresie |
| Niespełnione | Wymaganie nie zostało zrealizowane lub weryfikacja wykazała niezgodność |
| Niezweryfikowane | Nie uzyskano wystarczającego dowodu; podaj brak lub blokadę |
| Nie dotyczy | Kryterium nie ma zastosowania; podaj uzasadnienie bez samowolnego usuwania wymagań |

4. Raportuj krótko: wykonane kontrole i wyniki, wersję lub stan kodu, pokrycie względem progu, istotne pominięcia z przyczynami, problemy wcześniejsze i nierozwiązane błędy. Dla błędu podaj konkretny objaw i dostępną diagnozę.
5. Nie dołączaj pełnych logów sukcesu bez potrzeby. Nie ukrywaj ostrzeżeń wpływających na ocenę wyniku.
6. Odróżniaj ukończenie implementacji, weryfikacji i gotowość do integracji. Lokalny zapis pracy z nieukończoną weryfikacją jest dopuszczalny, ale nie oznacza gotowości do merge.

## Kryteria zakończenia

- Zakres sprawdzeń wynika z wymagań, zależności i ryzyka.
- Wykonano wymagane testy i kontrole dla aktualnej wersji zmian albo jawnie wskazano ich brak.
- Analiza statyczna, formater i linter przechodzą bez nowych błędów i bez rozszerzenia baseline.
- Pokrycie spełnia próg w każdej dotkniętej przestrzeni, a poniżej progu nowy i zmieniany kod go osiąga bez spadku łącznego pokrycia; wyłączenia są wąskie, uzasadnione w konfiguracji i ocenione w przeglądzie.
- Testy weryfikują istotne zachowanie, są czytelne i niezależne; konfiguracja jakości nie została osłabiona dla ukrycia błędów.
- Sprawdzono odpowiednie scenariusze negatywne, uprawnienia i przypadki brzegowe.
- UI zweryfikowano w zakresie zmiany lub jawnie oznaczono brak takiej możliwości.
- Problemy wcześniejsze odróżniono od nowych na podstawie dowodów; nierozstrzygnięte przyczyny są oznaczone.
- Kryteria akceptacji mają rzetelne statusy i dowody.
- Weryfikacja nie wywołała nieautoryzowanych skutków produkcyjnych ani nie ujawniła danych wrażliwych.
- Przed deklaracją gotowości do merge nie pozostają znane błędy wprowadzone przez zmianę, wymagane kontrole ani wymagane review do wykonania.
