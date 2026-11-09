# Standard pisania kodu dla agentów AI

Wersja: 1.4.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard przy pisaniu i zmianie kodu produkcyjnego, testów i skryptów. Dokument określa, jak kod ma wyglądać i być zbudowany: styl, nazewnictwo, typy, strukturę, obsługę błędów, komentarze i zależności.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasada nadrzędna

Prościej i skromniej znaczy lepiej. Kod ma rozwiązywać problem z zadania najmniejszym czytelnym środkiem. Nie buduj rozbudowanej struktury dla prostej funkcji, nie dodawaj abstrakcji, parametrów ani konfiguracji na przyszłe potrzeby bez podstawy w zadaniu.

Każda kolejna zasada tego dokumentu działa w granicach tej zasady.

## Styl i konwencje ekosystemu

- Stosuj konwencje najpowszechniejsze w danym języku i frameworku: zapis nazw, układ plików, formatowanie i idiomy. Przy wyborze między konwencjami wybieraj najbardziej znaną.
- Stosuj oficjalny lub powszechnie przyjęty standard stylu ekosystemu, np. PSR-12 lub PER Coding Style dla PHP, PEP 8 dla Pythona. Jeśli ekosystem nie ma takiego standardu, przyjmij domyślną konfigurację popularnego formatera, np. Prettier.
- Zapis nazw według ekosystemu, np. `camelCase` dla metod i zmiennych w PHP i JavaScript, `snake_case` dla funkcji i zmiennych w Pythonie, `PascalCase` dla klas.
- Jeśli język dopuszcza zamiennie apostrof i cudzysłów, stosuj apostrof. Wyjątek: ekosystem lub jego standardowy formater przyjmuje cudzysłów, np. Black w Pythonie.
- W istniejącym kodzie zachowuj jego konwencje, jeśli są spójne. Nie mieszaj stylów w jednym projekcie.

## Wersje i nowoczesne rozwiązania

- W nowym projekcie stosuj najnowsze stabilne wersje języka, frameworka, bazy danych i narzędzi. Gdy ekosystem rozróżnia wersje LTS i bieżące, wybierz najnowszą LTS, chyba że projekt potrzebuje funkcji z nowszej wersji.
- W istniejącym projekcie stosuj jego wersje. Podniesienie wersji języka lub frameworka to osobne zadanie.
- Stosuj nowoczesne konstrukcje dostępne w wersji języka projektu, gdy upraszczają kod, np. wyliczenia, właściwości tylko do odczytu, atrybuty, dopasowanie wzorców.
- Nie używaj przestarzałych API ani funkcji oznaczonych jako deprecated. Ostrzeżenia o deprecacji w zmienianym kodzie usuwaj.
- Rozwiązania wybieraj według aktualnej oficjalnej dokumentacji języka i frameworka, nie według pamięci ani starszych poradników.

## Czytelność dla ludzi i agentów AI

- Preferuj kod jawny przed „magicznym”. Nie składaj dynamicznie nazw klas, metod, pól ani tras z napisów, jeśli można je zapisać wprost.
- Każdy symbol, np. klasę, metodę, trasę, zdarzenie, klucz konfiguracji, da się znaleźć zwykłym wyszukiwaniem tekstu w repozytorium.
- Utrzymuj przewidywalną strukturę: podobne elementy w podobnych miejscach i z podobnymi nazwami, jeden główny koncept na plik.
- Nie ukrywaj zachowania w mechanizmach trudnych do prześledzenia, np. nadmiernej refleksji, globalnych hookach, automatycznej rejestracji bez wyraźnej konwencji frameworka.

## Nazewnictwo

- Nazwy są możliwie krótkie, ale czytelne bez dodatkowego kontekstu. Nie stosuj nazw bez znaczenia (`$aaa`, `$tmp2`, `data1`) ani niezrozumiałych skrótów.
- Zmienna lokalna o krótkim zasięgu może mieć prostą nazwę, jeśli jest jednoznaczna, np. `$count`, `$total`. Licznik pętli może mieć nazwę `$i`, `$j`.
- Nazwa klasy jest jednoznaczna i opisuje jedną odpowiedzialność. Unikaj nazw ogólnych bez treści, np. `Manager`, `Helper`, `Utils`, `Processor`, jeśli nie mówią, czym zarządzają lub co przetwarzają.
- Nazwa metody razem z nazwą klasy mówi od razu, co robi kod, np. `InvoiceRepository::findUnpaid()`. Nie powtarzaj w nazwie metody nazwy klasy, np. `Invoice::getInvoiceTotal()` → `Invoice::total()`.
- Wartości logiczne nazywaj pytaniem: `isActive`, `hasAccess`, `canEdit`, `shouldRetry`, w zapisie właściwym dla ekosystemu.
- Nazwy stosujesz w języku angielskim, zgodnie ze słownictwem domeny projektu. Jedno pojęcie ma jedną nazwę w całym projekcie.
- Jeśli klasa realizuje wzorzec projektowy, nazwa może go wskazywać, np. `PaymentGatewayFactory`, `OrderCreatedListener`.

## Typy

- Stosuj ścisłe typowanie, nawet jeśli język go nie wymaga: typy parametrów, wartości zwracanych i właściwości. W PHP deklaruj `declare(strict_types=1);` w każdym nowym pliku. W istniejącym pliku bez tej deklaracji dodaj ją tylko wtedy, gdy zmiana obejmuje ten plik, a testy potwierdzają brak regresji.
- Nie stosuj typów ogólnych zastępujących brak typu, np. `mixed` w PHP, `any` w TypeScript, `Any` w Pythonie. Wyjątek dopuszczaj tylko tam, gdzie typ jest naprawdę nieznany, np. na granicy z niestypowaną biblioteką, i zawężaj go od razu.
- Nie osłabiaj typów dla wygody ani w celu uciszenia narzędzia.
- Preferuj typy wyrażające znaczenie: wyliczenia (`enum`) zamiast „magicznych” napisów i liczb, obiekty wartości zamiast luźnych tablic dla danych o stałej strukturze.

## Struktura i architektura

- Stosuj strukturę i idiomy frameworka. Nie buduj własnej architektury obok frameworka.
- Dziel kod na warstwy o jasnych odpowiedzialnościach:
  - **wejście**, np. kontroler, komenda CLI, handler kolejki: cienkie; przyjmuje dane, waliduje je, wywołuje logikę i zwraca wynik;
  - **logika aplikacji**, np. serwis, przypadek użycia: realizuje operację biznesową i koordynuje pozostałe elementy;
  - **domena**: reguły biznesowe, bez zależności od frameworka, bazy i usług zewnętrznych, gdy złożoność domeny to uzasadnia;
  - **infrastruktura**, np. repozytorium, klient API, adapter: dostęp do bazy, plików i usług zewnętrznych.
- Zależności kierują się do środka: wejście → logika aplikacji → domena. Infrastruktura implementuje to, czego potrzebuje logika, a nie odwrotnie.
- W małej aplikacji lub prostym module nie twórz wszystkich warstw na zapas. Dodaj warstwę, gdy pojawia się logika, która jej wymaga.
- W większej aplikacji grupuj kod według modułów funkcjonalnych, np. `Billing`, `Orders`, a w nich według warstw.
- Zależności, czas, losowość i konfigurację przekazuj jawnie, np. przez konstruktor, aby można je było zastąpić w testach. Unikaj globalnego stanu i ukrytych efektów ubocznych.

## Wielkość i podział kodu

- Metoda robi jedną rzecz. Jeśli opis jej działania wymaga słowa „i”, rozważ podział.
- Klasa ma jedną odpowiedzialność i jeden powód do zmiany. Nie twórz klas i metod, które robią wszystko naraz.
- Dziel kod według odpowiedzialności, nie według liczby linii. Nie rozbijaj prostej, spójnej operacji na wiele drobnych elementów tylko po to, aby były krótsze.
- Długa lista parametrów, zwykle więcej niż 3–4, sygnalizuje potrzebę obiektu parametrów lub podziału metody.
- Unikaj głębokiego zagnieżdżenia. Stosuj wczesny powrót (`return`) dla warunków brzegowych.

## Zasady projektowe i wzorce

- Stosuj SOLID, DRY, KISS i YAGNI, ale w granicach rozsądku. Zasada ma upraszczać zmianę i testowanie, a nie mnożyć kod.
- DRY dotyczy powielonej wiedzy, nie podobnego wyglądu kodu. Nie łącz fragmentów, które są podobne przypadkiem i mogą zmieniać się niezależnie.
- Nie twórz interfejsu z jedną implementacją, jeśli nie jest potrzebny do testów, granicy modułu lub wymiany implementacji.
- Stosuj znane wzorce projektowe, gdy rozwiązują rzeczywisty problem, np. strategia zamiast rosnącego `switch`, fabryka dla złożonego tworzenia obiektów, adapter dla usługi zewnętrznej. Preferuj wzorce wspierane przez framework.
- Nie wprowadzaj wzorca dla jednego prostego przypadku. Wzorzec jest uzasadniony, gdy kod bez niego byłby trudniejszy do zrozumienia lub zmiany.

## Obsługa błędów

- Stosuj idiomatyczny mechanizm języka: wyjątki w PHP, Pythonie i JavaScript, zwracane błędy tam, gdzie język tak przyjmuje, np. Go, Rust.
- Twórz własne wyjątki dla błędów domenowych, np. `OrderAlreadyShipped`. Utrzymuj ich niewielką, czytelną hierarchię; nie twórz osobnej klasy dla każdego miejsca w kodzie.
- Nie przechwytuj błędów, z którymi nie możesz zrobić nic sensownego. Nie wyciszaj wyjątków pustym `catch`.
- Nie przechwytuj ogólnych wyjątków (`Exception`, `Throwable`) poza granicą systemu, np. globalnym handlerem HTTP lub workera.
- Przy przekazywaniu błędu dalej dodaj kontekst i zachowaj błąd pierwotny jako przyczynę.
- Zamianę błędów na odpowiedzi dla użytkownika wykonuj w jednym miejscu na granicy, np. w handlerze błędów frameworka. Komunikat dla użytkownika nie ujawnia szczegółów wewnętrznych.
- Loguj błąd raz, tam gdzie jest obsługiwany. Nie loguj i nie rzucaj ponownie tego samego błędu na każdym poziomie.
- Rozróżniaj błędy oczekiwane, np. walidacja, brak zasobu, konflikt, od nieoczekiwanych. Oczekiwane obsługuj jawnie, nieoczekiwane przekazuj do globalnej obsługi.

## Komentarze

- Dobrze napisany kod nie wymaga komentarzy: nazwy i podział na małe, logiczne części wyjaśniają jego działanie.
- Nie komentuj tego, co robi klasa, metoda lub fragment kodu. Jeśli kod wymaga takiego komentarza, popraw nazwy lub podział.
- Dodawaj adnotacje w komentarzach, np. PHPDoc, tylko wtedy, gdy wymaga ich narzędzie analizy statycznej lub generator dokumentacji API albo język nie pozwala wyrazić typu w kodzie, np. typ elementów tablicy.
- Dopuszczalny jest krótki komentarz wyjaśniający „dlaczego”, gdy kod tego nie wyraża: nieoczywista reguła biznesowa, obejście błędu biblioteki, świadome ograniczenie.
- Nie zostawiaj zakomentowanego kodu.

## Zależności

1. Zanim dodasz zależność, sprawdź, czy problem rozwiązuje biblioteka standardowa, framework lub zależność już używana w projekcie.
2. Nową zależność wybieraj według kryteriów: aktywne utrzymanie, popularność, zgodna licencja, brak znanych podatności, rozsądny rozmiar. Preferuj pakiety oficjalne lub zalecane przez framework.
3. Nie dodawaj zależności dla kilku linii prostego kodu.
4. Wersje i API sprawdzaj w oficjalnych źródłach, nie z pamięci. Przy dodawaniu stosuj najnowszą stabilną wersję zgodną z projektem.
5. Commituj plik blokady wersji razem z manifestem. Nie aktualizuj niezwiązanych zależności przy okazji zadania.
6. Uzasadnij dodanie zależności w raporcie lub opisie zmiany.
7. Nie dodawaj pakietów porzuconych, oznaczonych jako przestarzałe ani niewspierających wersji języka i frameworka projektu.
8. Przestarzałe lub porzucone zależności zastane w projekcie zgłaszaj jako propozycje zadań aktualizacji. Nie aktualizuj ich przy okazji zadania.

## Porządek w kodzie

- Nie zostawiaj martwego kodu, nieużywanych importów, zmiennych, parametrów ani plików.
- Nie zostawiaj kodu diagnostycznego, np. `var_dump`, `print`, `console.log`.
- Nie stosuj „magicznych” wartości; nadaj im nazwę przez stałą lub wyliczenie.
- Nie edytuj ręcznie kodu generowanego przez narzędzia; odtwarzaj go narzędziem.
- Refaktoryzację potrzebną do zadania wykonuj jako osobny krok bez zmiany zachowania.
- W projekcie istniejącym i legacy zmieniaj kod przyrostowo. Nie przepisuj modułów ani nie zmieniaj architektury przy okazji zadania.

## Kryteria zakończenia

- Rozwiązanie jest najprostsze, które spełnia wymagania; nie zawiera struktur ani abstrakcji na zapas.
- Styl, zapis nazw i idiomy odpowiadają ekosystemowi i istniejącemu kodowi.
- Kod korzysta z aktualnych wersji i nowoczesnych konstrukcji, bez przestarzałych API.
- Kod jest jawny i łatwy do przeszukania, bez dynamicznie składanych nazw i ukrytych mechanizmów.
- Nazwy są krótkie, czytelne i jednoznaczne; nazwa metody z nazwą klasy opisuje działanie.
- Kod jest ściśle typowany, bez typów ogólnych zastępujących brak typu.
- Warstwy mają jasne odpowiedzialności, a zależności właściwy kierunek.
- Błędy są obsłużone lub przekazane z kontekstem, logowane raz i bez wyciszania.
- Komentarze występują tylko tam, gdzie wymaga ich narzędzie lub wyjaśniają „dlaczego”.
- Nowe zależności są uzasadnione, sprawdzone w źródłach i zablokowane w wersji.
- Kod nie zawiera martwych fragmentów, kodu diagnostycznego ani magicznych wartości.
