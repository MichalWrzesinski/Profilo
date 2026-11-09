# Standard projektowania wyglądu i doświadczenia użytkownika (UX/UI) dla agentów AI

Wersja: 1.0.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard po analizie produktu, przy tworzeniu wyglądu nowej aplikacji albo nowego obszaru bez wzorca w istniejącej aplikacji. Dokument określa, jak ustalić styl, identyfikację, przepływy, makiety i design system tak, aby development nie musiał pytać o wygląd.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasady nadrzędne

- **Od ogółu do szczegółu.** Najpierw uchwyć, co się użytkownikowi podoba, dopiero potem dopracowuj szczegóły. Zmiana kierunku na początku jest tania, na makiecie docelowej droga.
- **Pokazuj, nie opisuj.** Każdą propozycję wizualną przedstaw jako stronę wyświetlaną w przeglądarce, nie jako opis słowny.
- **Prawdziwa treść i kontekst.** Makiety pokazują prawdziwe teksty i dane z dokumentacji produktu, w rzeczywistym rozmiarze, na telefonie i komputerze. Nie stosuj tekstu zastępczego, np. „lorem ipsum”.
- **Wygląd zamknięty przed developmentem.** Po akceptacji makiet docelowych development nie wraca z pytaniami o wygląd.

## Wejście

- Dokumentacja produktu z analizy produktu: role, przebiegi, scenariusze, zakres pierwszej wersji.
- Opis stylu od użytkownika.

## Opis stylu od użytkownika

Styl jest decyzją użytkownika. Opis stylu powinien zawierać:

- strony lub aplikacje, które się podobają, i co w nich się podoba;
- strony lub aplikacje, które się nie podobają, jeśli są;
- tryb: jasny, ciemny albo oba;
- kolorystykę: kolory wiodące, kolory do uniknięcia, istniejące kolory firmowe;
- gęstość: dużo treści i elementów na ekranie albo minimalizm i dużo wolnej przestrzeni;
- istniejące logo i identyfikację, jeśli są;
- 3–5 słów opisujących charakter marki, np. „spokojny, profesjonalny, przyjazny”.

Jeśli opis nie zawiera któregoś punktu, zapytaj o wszystkie brakujące w jednej wiadomości. Przy każdym pytaniu podaj propozycję wynikającą z charakteru produktu, np. dla aplikacji finansowej: jasny tryb, stonowana paleta, umiarkowana gęstość.

## Kolejność pracy

| Krok | Wynik | Akceptacja użytkownika |
|---|---|---|
| 1. Przepływy użytkownika | Lista ekranów i przejść między nimi | — |
| 2. Kierunek stylu | Wybrany wariant stylu | tak |
| 3. Logo i identyfikacja | Logo, ikona, paleta | razem z kierunkiem stylu |
| 4. Makiety szkicowe | Układ kluczowych ekranów, bez stylu | tak |
| 5. Makiety docelowe | Kluczowe ekrany w wybranym stylu | tak |
| 6. Design system | Tokeny i komponenty | — |

### 1. Przepływy użytkownika

- Na podstawie przebiegów z dokumentacji produktu wypisz potrzebne ekrany i przejścia między nimi, osobno dla każdej roli.
- Zapisz przepływy jako diagram Mermaid.
- Wskaż kluczowe ekrany: ekrany głównego przebiegu głównej roli z pierwszej wersji, zwykle 5–10.

### 2. Kierunek stylu

- Przygotuj 3 wyraźnie różne warianty stylu, zgodne z opisem stylu. Każdy wariant pokazuje ten sam kluczowy ekran, z prawdziwą treścią, w widoku na telefon i komputer.
- Przy każdym wariancie podaj, jak odpowiada słowom opisującym charakter marki.
- Pokaż warianty obok siebie na jednej stronie.
- Użytkownik wybiera wariant albo łączy elementy kilku, np. kolory z jednego i typografię z drugiego.
- Jeśli po dwóch rundach żaden wariant nie pasuje, zapytaj, co konkretnie nie odpowiada w każdym z nich, i przygotuj nowy zestaw, wyraźnie różny od poprzednich.

### 3. Logo i identyfikacja

- Jeśli opis podaje istniejące logo i kolorystykę, stosuj je.
- Jeśli ich nie podaje, przygotuj domyślnie:
  - logo w formie napisu ozdobną czcionką oraz prostej ikony graficznej;
  - ikonę jako osobny plik, używaną także jako favicon i ikona aplikacji;
  - paletę kolorów zgodną z wybranym kierunkiem stylu.
- Czcionki wybieraj z licencją pozwalającą na użycie komercyjne, np. z Google Fonts.
- Logo i ikonę zapisz w formacie SVG. Favicony i ikony aplikacji wygeneruj w standardowych rozmiarach, np. `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`.

### 4. Makiety szkicowe

- Przygotuj układ kluczowych ekranów w odcieniach szarości: rozmieszczenie elementów, hierarchię treści, nawigację. Bez kolorów i dekoracji.
- Każdy ekran ma widok na telefon i komputer.
- Użytkownik akceptuje układ, zanim powstaną makiety docelowe.

### 5. Makiety docelowe

- Przygotuj kluczowe ekrany w wybranym stylu, na podstawie zaakceptowanych makiet szkicowych.
- Pokaż także ważne stany kluczowych ekranów: brak danych, błąd, ładowanie.
- Pozostałe ekrany nie dostają makiet. Development buduje je z komponentów design systemu na wzór kluczowych ekranów.

### 6. Design system

- Wyprowadź design system z makiet docelowych:
  - **tokeny:** kolory, skala typografii, skala odstępów, zaokrąglenia, obramowania, cienie, czasy animacji;
  - **komponenty:** każdy rodzaj elementu z wariantami, np. przycisk `primary`, `secondary`, `danger`, i stanami: domyślny, najechanie, fokus, wyłączony, błąd, ładowanie.
- Zapisz tokeny w pliku, z którego frontend korzysta bezpośrednio, np. `tokens.css` ze zmiennymi CSS.
- Przygotuj stronę design systemu, która pokazuje wszystkie tokeny i komponenty z wariantami i stanami.

## Tryby jasny i ciemny

- Przygotuj tylko tryb wskazany w opisie projektu.
- Jeśli opis nie zakłada obu trybów, nie projektuj drugiego trybu ani podziału tokenów na motywy.

## Ton komunikatów

- Razem z kierunkiem stylu ustal krótko ton tekstów, np. „per ty, krótko, bez żargonu”.
- Dołącz przykłady: komunikat błędu, potwierdzenie operacji, stan braku danych.
- Development pisze teksty interfejsu w tym tonie bez dodatkowych pytań.

## Dostępność na etapie projektu

- Sprawdzaj wymagania dostępności ze standardu frontendu już w makietach: kontrast tekstu i elementów, wielkość elementów dotykowych, widoczny fokus, informację przekazywaną nie tylko kolorem.
- Wariant stylu, który nie spełnia wymagań kontrastu, popraw przed pokazaniem użytkownikowi.

## Materiały projektu

Materiały zapisuj w `docs/design/`:

```
docs/design/
├── style.md              opis stylu, słowa charakteru marki, wybrany kierunek, ton komunikatów
├── flows.md              przepływy użytkownika (Mermaid), lista kluczowych ekranów
├── tokens.css            tokeny design systemu
├── design-system.html    strona z tokenami i komponentami
├── brand/                logo.svg, icon.svg, favicony i ikony aplikacji
└── mockups/              makiety HTML/CSS i ich zrzuty PNG
```

- Makiety mają postać stron HTML/CSS korzystających z `tokens.css`.
- Do każdej makiety dołącz zrzut ekranu PNG dla widoku na telefon i komputer, aby makietę można było obejrzeć bez uruchamiania.

## Nowy obszar w istniejącej aplikacji

- Stosuj istniejący design system, styl i ton. Pomiń kroki kierunku stylu oraz logo i identyfikacji.
- Przygotuj przepływy oraz makiety szkicowe i docelowe tylko dla kluczowych ekranów nowego obszaru.
- Nowe komponenty dopisz do design systemu. Nie twórz wariantów istniejących komponentów z drobnymi różnicami.

## Kryteria zakończenia

- Opis stylu od użytkownika jest kompletny albo uzupełniony w jednej rundzie pytań z propozycjami.
- Kierunek stylu wybrano spośród 3 wariantów pokazanych obok siebie, na prawdziwej treści.
- Logo, ikona i paleta pochodzą z opisu projektu albo zostały przygotowane według zasad domyślnych.
- Makiety szkicowe i docelowe kluczowych ekranów mają widok na telefon i komputer i zostały zaakceptowane przez użytkownika.
- Design system zawiera tokeny i komponenty z wariantami i stanami, a frontend może korzystać z tokenów bezpośrednio.
- Zaprojektowano tylko tryby wskazane w opisie projektu.
- Ton komunikatów jest ustalony z przykładami.
- Makiety spełniają wymagania dostępności ze standardu frontendu.
- Materiały są zapisane w `docs/design/`.
