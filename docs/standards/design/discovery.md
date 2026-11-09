# Standard analizy produktu (discovery) dla agentów AI

Wersja: 1.0.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard przy tworzeniu nowej aplikacji oraz nowego obszaru produktu w istniejącej aplikacji, np. modułu z własnymi rolami, ekranami i regułami. Dokument określa, jak zamienić opis od użytkownika w kompletną dokumentację produktu: cel, użytkowników, role, scenariusze, reguły biznesowe i zakres pierwszej wersji.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasada nadrzędna

Analiza produktu jest głównym miejscem współpracy człowieka z agentem. Tu zapadają wszystkie decyzje produktowe, aby planowanie i development nie musiały o nie pytać. Lepiej zadać pytanie teraz niż zatrzymać pracę później.

Pytaj mądrze: zbieraj pytania w rundy, do każdego dawaj gotową propozycję i pokazuj konkretne przykłady zamiast abstrakcyjnych pytań.

## Wejście

- Opis produktu od użytkownika: tekst, notatki, materiały od klienta, wynik wcześniejszych rozmów.
- Opis może być niepełny i zawierać luki lub sprzeczności w logice. Wykrycie ich jest zadaniem agenta, nie użytkownika.

## Głębokość analizy

Na początku oceń dojrzałość opisu i na tej podstawie dobierz głębokość analizy. Miarą zakończenia jest kompletność dokumentacji, nie czas ani liczba rund.

| Dojrzałość opisu | Rozpoznanie | Co robi agent | Zwykle |
|---|---|---|---|
| **Szczegółowy** | Są role, scenariusze, reguły i zakres | Zapisuje dokumentację, wyszukuje luki i sprzeczności, zadaje jedną serię pytań | 1 runda |
| **Częściowy** | Jest cel i główne funkcje, brakuje reguł i przypadków brzegowych | Szkic dokumentacji z założeniami, potem rundy uzupełnień według obszarów | 2–3 rundy |
| **Luźny pomysł** | Jest problem lub idea, brak struktury | Najpierw rozpoznanie: problem, użytkownicy, ich cele i przebieg działań; potem propozycje funkcji i zakresu; dopiero potem reguły | 3–5 rund |

Ocenę dojrzałości i plan rund przedstaw użytkownikowi w pierwszej wiadomości, jednym zdaniem.

## Przebieg rundy

1. **Podsumowanie:** krótko, co agent zrozumiał, własnymi słowami. Pozwala użytkownikowi szybko wyłapać nieporozumienia.
2. **Propozycje:** dla każdej decyzji gotowe rozwiązanie z rekomendacją, a przy realnych wariantach 2–3 warianty obok siebie z konsekwencjami.
3. **Pytania:** tylko te, na które propozycja nie wystarcza, zebrane w jednej wiadomości, uporządkowane od najważniejszych.
4. **Zapis:** po odpowiedzi agent aktualizuje dokumentację produktu. Każda kolejna runda zaczyna się od zaktualizowanego stanu.

Rundę ograniczaj do decyzji, które użytkownik może podjąć jednym czytaniem, np. kilkunastu punktów. Resztę przenieś do kolejnej rundy.

## Rozumienie potrzeb

Potrzeby biznesowe są indywidualne, a użytkownik często nie potrafi ich nazwać wprost. Stosuj uznane techniki:

- **Pytaj o cel, nie tylko o funkcję.** Za każdą funkcją ustal, jaki problem rozwiązuje i po czym poznać sukces. Funkcja zaproponowana przez użytkownika jest jednym z możliwych rozwiązań, nie wymaganiem samym w sobie.
- **Proś o prawdziwe przykłady.** Konkretny przypadek z życia, np. „klient zamówił, zapłacił, a potem zmienił adres”, ujawnia reguły, których nie widać w ogólnym opisie.
- **Opowiadaj przebieg.** Przejdź z użytkownikiem dzień pracy każdej roli albo drogę klienta krok po kroku i zapytaj, co dzieje się w każdym kroku.
- **Pokazuj zamiast pytać.** Ludzie łatwiej oceniają gotową propozycję niż odpowiadają na otwarte pytanie. Zamiast „jak mają działać zwroty?” przedstaw konkretną regułę i zapytaj, czy pasuje.
- **Parafrazuj.** Po każdej rundzie zapisz rozumienie własnymi słowami i pozwól je poprawić.
- **Zapisuj historie użytkownika** w formie „Jako [rola] chcę [działanie], aby [cel]”. Część „aby” chroni przed funkcjami bez uzasadnienia.

## Wykrywanie luk i sprzeczności

Opis od użytkownika zawsze ma luki. Sprawdzaj go systematycznie, nie tylko intuicyjnie:

- **Role:** co każda rola może, czego nie może, kto nadaje role i kto je odbiera.
- **Cykl życia obiektów:** dla każdego ważnego obiektu, np. zamówienia, konta, faktury: kto go tworzy, zmienia, usuwa lub archiwizuje i co dzieje się z powiązanymi danymi.
- **Statusy:** wszystkie statusy, dozwolone przejścia, kto lub co je wywołuje i co się dzieje przy próbie przejścia niedozwolonego.
- **Pieniądze:** każdy przepływ pieniędzy, zwroty, częściowe płatności, waluty, zaokrąglenia, podatki.
- **Czas:** terminy, wygasanie, strefy czasowe, działania cykliczne.
- **Przypadki „co jeśli”:** dla każdego scenariusza głównego co najmniej jeden negatywny, np. brak uprawnień, błędne dane, równoczesna zmiana, awaria usługi zewnętrznej.
- **Sprzeczności:** reguły, które wykluczają się w jakiejś sytuacji. Wskaż sytuację i zaproponuj rozstrzygnięcie.
- **Typowe braki:** sprawdź listę typowych braków ze standardu sprawdzenia gotowości, np. uprawnienia, istniejące dane, usuwanie, powiadomienia.

Każdą wykrytą lukę przedstaw z propozycją jej wypełnienia. Nie zostawiaj luki bez propozycji.

## Zakres pierwszej wersji

Stosuj uznane praktyki zwinnego wytwarzania oprogramowania:

- **Mapa historii użytkownika (story mapping):** ułóż główne działania użytkownika w kolejności przebiegu, a pod każdym działaniem historie od najprostszej do najbardziej rozbudowanej.
- **Priorytety MoSCoW** dla każdej historii: *Must* (musi być), *Should* (powinno być), *Could* (może być), *Won't now* (nie teraz).
- **Pierwsza wersja (MVP)** zawiera tylko historie *Must* i spełnia warunki:
  - obejmuje główny przebieg głównej roli od początku do końca, np. od rejestracji do zakończonego zamówienia;
  - każdy krok przebiegu ma najprostszą wersję, która rozwiązuje problem użytkownika;
  - zawiera wymagania bezpieczeństwa i prawne, niezależnie od priorytetu;
  - nie zawiera funkcji, bez których główny przebieg działa, np. raportów, eksportu, rozbudowanych ustawień.
- Agent proponuje podział, a użytkownik decyduje o granicy pierwszej wersji.
- Historie spoza pierwszej wersji trafiają do planu kolejnych wersji w `overview.md`. Nie są usuwane.

## Analiza biznesowa rozszerzona

Wykonuj ją tylko na prośbę użytkownika albo gdy opis wskazuje produkt komercyjny, a model biznesowy nie jest określony:

- konkurencja i podobne rozwiązania: co robią, czym produkt ma się wyróżniać;
- model biznesowy, np. w formie Lean Canvas: problem, segmenty klientów, propozycja wartości, kanały, przychody, koszty;
- sposób zarabiania, np. abonament, prowizja, sprzedaż jednorazowa, i jego wpływ na funkcje, np. plany, limity, płatności.

## Dokumentacja produktu

Dokumentacja produktu jest w `docs/product/`, po angielsku, w Markdown. Pliki obszarów mają stałe sekcje, aby planowanie, development i kolejne analizy mogły z nich korzystać bez zgadywania.

```
docs/product/
├── overview.md
├── glossary.md
└── areas/
    ├── orders.md
    └── payments.md
```

### `overview.md`

```markdown
# Product overview
## Product        one paragraph: what it is and for whom
## Problem        what problem it solves
## Users and roles   table: role, description, main goals
## Goals          how success is measured
## Version 1 scope   list of areas and Must stories
## Later          stories outside version 1, with MoSCoW priority
## Constraints    languages, legal requirements, external services
```

### `glossary.md`

Słownik pojęć domeny: termin, definicja, nazwa w kodzie. Jedno pojęcie ma jedną nazwę w dokumentacji, rozmowie i kodzie.

```markdown
| Term | Definition | Code name |
|---|---|---|
| Order | A customer's request to buy products, created at checkout | `Order` |
| Refund | Return of money for a cancelled order | `Refund` |
```

### Plik obszaru

```markdown
# Orders

## Purpose
One or two sentences.

## Roles and permissions
| Role | Can |
|---|---|
| Customer | Create, view and cancel own orders |

## User stories
- ORD-US-1: As a customer, I want to cancel an order before shipment, so that I get my money back.

## Business rules
- ORD-BR-1: An order can be cancelled only before its status is "shipped".
- ORD-BR-2: A cancelled order is refunded in full to the original payment method.

## Statuses
(Mermaid state diagram and a table: from, to, trigger, who)

## Limits and validation
## Notifications
## Edge cases
## Open questions
```

- Reguły biznesowe i historie mają stałe identyfikatory, np. `ORD-BR-1`. Zadania i testy mogą się do nich odwoływać.
- Statusy i przejścia zapisuj diagramem Mermaid oraz tabelą przejść. Diagram GitHub wyświetla bez dodatkowych narzędzi.
- Sekcja `Open questions` jest pusta, zanim obszar trafi do planowania.

## Nowy obszar w istniejącej aplikacji

- Stosuj ten standard tylko do nowego obszaru, nie do całej aplikacji.
- Korzystaj z istniejącej dokumentacji produktu, słownika i ról. Nowe pojęcia dopisz do słownika; nie twórz synonimów istniejących.
- Dokumentację nowego obszaru zapisz jako nowy plik w `docs/product/areas/` i zaktualizuj `overview.md`.

## Wynik i zakończenie

Analiza produktu jest zakończona, gdy:

- dokumentacja produktu jest kompletna według formatu, a sekcje `Open questions` są puste;
- wszystkie materiały produktowe oznaczone jako blokujące na liście dla nowego projektu w standardzie sprawdzenia gotowości są uzupełnione;
- użytkownik zatwierdził granicę pierwszej wersji.

Na koniec przedstaw krótkie podsumowanie: zakres pierwszej wersji, najważniejsze decyzje i założenia agenta do sprawdzenia na stagingu.

## Kryteria zakończenia

- Głębokość analizy dobrano do dojrzałości opisu; plan rund przedstawiono na początku.
- Każda runda zawierała podsumowanie, propozycje z rekomendacją i pytania zebrane w jednej wiadomości.
- Za każdą funkcją jest cel; historie użytkownika mają formę „Jako… chcę… aby…”.
- Luki i sprzeczności wykryto systematycznie i każdą przedstawiono z propozycją.
- Pierwsza wersja obejmuje główny przebieg głównej roli od początku do końca, tylko z historiami *Must*; reszta jest w planie kolejnych wersji.
- Dokumentacja produktu ma ustalony format, słownik pojęć i identyfikatory reguł; nie zawiera otwartych pytań.
