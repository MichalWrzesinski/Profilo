# Standard przeglądu zmian (code review) dla agentów AI

Wersja: 1.2.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard, gdy zmiana jest gotowa do integracji z gałęzią docelową. Dokument określa, kto wykonuje przegląd, jak głęboko, co sprawdza, jak zgłasza uwagi i co dzieje się z nimi dalej.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasady nadrzędne

- Każda zmiana przeznaczona do integracji przechodzi przegląd. Autor nie zatwierdza własnej zmiany.
- Przegląd sprawdza dwie rzeczy: czy zmiana **działa** zgodnie z kryteriami akceptacji i czy kod jest **poprawny** zgodnie ze standardami projektu.
- Głębokość przeglądu jest proporcjonalna do ryzyka zmiany. Pełna weryfikacja tam, gdzie jest potrzebna; bez powtarzania pracy, którą wykonały już automatyczne kontrole.

## Recenzent

- Przegląd wykonuje subagent recenzent, uruchomiony z czystym kontekstem, niezależnie od agenta, który napisał kod.
- Recenzent dostaje:
  - cel zadania i kryteria akceptacji;
  - zakres zmian: branch, zakres commitów lub diff;
  - komendy uruchomienia aplikacji, testów i kontroli;
  - standardy obowiązujące w projekcie.
- Recenzent nie dostaje opisu ani uzasadnienia rozwiązania od autora. Ocenia zmianę na podstawie wymagań, kodu i wyników, nie deklaracji autora.
- Recenzent nie edytuje kodu. Zgłasza uwagi, a poprawki wprowadza autor. Dzięki temu poprawki recenzenta nie omijają kolejnego przeglądu.
- Jeśli uruchomienie subagenta nie jest możliwe, wykonaj przegląd w nowej sesji z tymi samymi danymi wejściowymi. Jeśli i to nie jest możliwe, zgłoś, że przegląd nie został wykonany.

## Głębokość przeglądu

| Rodzaj zmiany | Zakres przeglądu |
|---|---|
| Mechaniczna: tłumaczenia, przeniesienie plików, zmiana nazw, kod generowany, dokumentacja | Diff i wyniki automatycznych kontroli. Recenzent potwierdza, że zmiana jest wyłącznie mechaniczna, np. przeniesienie bez zmian treści. Bez uruchamiania aplikacji. |
| Zmiana zachowania: nowa funkcja, naprawa błędu, refaktoryzacja | Analiza kodu, testy, uruchomienie aplikacji i sprawdzenie przepływów objętych zmianą. |
| Podwyższonego ryzyka: uwierzytelnianie, uprawnienia, dane osobowe, płatności, migracje, sekrety, kontrakty API | Jak przy zmianie zachowania oraz osobne sprawdzenie bezpieczeństwa: scenariusze negatywne, próby dostępu do cudzych danych, ujawnianie danych w odpowiedziach. |

Jeśli zmiana łączy kilka rodzajów, stosuj zakres najwyższego z nich do części, która go wymaga.

## Oszczędność zasobów

- Nie uruchamiaj ponownie kontroli, których aktualny wynik dla tego samego commita jest dostępny, np. z CI. Uruchom je, jeśli wyniku nie ma lub jest nieaktualny.
- Czytaj diff i kod bezpośrednio z nim powiązany. Nie analizuj całego repozytorium.
- Uruchamiaj aplikację tylko w zakresie przepływów objętych zmianą.
- Po poprawkach autora sprawdzaj ponownie tylko zmienione części i uwagi, których dotyczyły.
- Nie zgłaszaj uwag, które rozstrzygają automatyczne narzędzia: formatowanie, styl, kolejność importów.

## Co sprawdza recenzent

1. **Działanie:** kryteria akceptacji są spełnione w uruchomionej aplikacji lub testach; przypadki brzegowe i błędy są obsłużone.
2. **Poprawność:** logika, obsługa błędów, spójność danych, transakcje, współbieżność.
3. **Standardy:** zgodność ze standardami kodu, bezpieczeństwa i kontroli jakości projektu, w tym próg pokrycia.
4. **Testy:** sprawdzają istotne zachowanie, a nie tylko podnoszą pokrycie; obejmują scenariusze negatywne.
5. **Zakres:** zmiana nie wykracza poza zadanie; nie zawiera niepowiązanych zmian ani pozostałości, np. kodu diagnostycznego.
6. **Historia:** commity mają pojedynczy cel, właściwy obszar i poprawne wiadomości.
7. **Dokumentacja:** jest zaktualizowana, jeśli zmiana tego wymaga.

## Uwagi

- Każda uwaga opiera się na kryterium akceptacji, standardzie projektu lub konkretnym ryzyku z opisem skutku. Osobiste preferencje recenzenta nie są uwagą.
- Uwagi dotyczące nazewnictwa, podziału kodu i struktury zgłaszaj tylko wtedy, gdy naruszają standard kodu projektu.
- Każda uwaga ma kategorię:

| Kategoria | Znaczenie | Co dalej |
|---|---|---|
| Blokująca | Błąd, niespełnione kryterium, podatność, naruszenie standardu | Autor musi poprawić przed integracją |
| Drobna | Oczywista, lokalna poprawka bez wpływu na zachowanie, np. literówka, zbędny import | Recenzent podaje gotową poprawkę; autor ją wprowadza bez dyskusji |
| Sugestia | Usprawnienie, które nie jest wymagane | Autor decyduje; może ją zgłosić jako osobne zadanie |
| Do decyzji człowieka | Istotna kwestia produktowa, np. reguła biznesowa, zmiana zachowania, na którym polegają użytkownicy, sprawy pieniędzy lub danych osobowych, której nie rozstrzyga żadne źródło projektu | Przekaż użytkownikowi |

- Uwaga zawiera: miejsce w kodzie, opis problemu, skutek i propozycję rozwiązania.

## Spory i rundy przeglądu

- Spór autora z recenzentem o uwagę blokującą rozstrzygaj według kryteriów akceptacji i standardów projektu.
- Gdy standardy nie rozstrzygają sporu technicznego, przyjmij wariant prostszy i bezpieczniejszy, a decyzję zapisz zgodnie ze standardem dokumentacji.
- Do użytkownika trafiają tylko spory o istotne kwestie produktowe. Spory o drobne kwestie produktowe rozstrzygaj według istniejących wzorców aplikacji i powszechnie przyjętych praktyk UX.
- Autor nie pomija uwagi blokującej ani nie zmienia jej kategorii samodzielnie.
- Jeśli po 3 rundach przeglądu pozostają uwagi blokujące, zatrzymaj przegląd i zgłoś problem z podsumowaniem stanowisk.

## Wielkość zmian

- Nie stosuj limitu liczby linii. Kryterium jest możliwość rzetelnej oceny zmiany jako całości.
- Zmiany mechaniczne, np. przeniesienie plików, tłumaczenia, kod generowany, umieszczaj w osobnych commitach lub PR niż zmiany logiki, aby recenzent mógł je ocenić szybko i osobno.
- Jeśli recenzent nie może rzetelnie ocenić zmiany z powodu jej wielkości lub niejednorodności, zgłasza to jako uwagę blokującą z propozycją podziału.

## Wynik przeglądu

Recenzent kończy przegląd krótkim raportem:

- werdykt: **zatwierdzone**, **do poprawy** albo **do decyzji człowieka**;
- commit, którego dotyczy werdykt;
- głębokość przeglądu i wykonane sprawdzenia, w tym uruchomione przepływy aplikacji;
- uwagi według kategorii;
- czego nie sprawdzono i dlaczego.

Zatwierdzenie dotyczy wskazanego commita. Każdy kolejny commit wymaga ponownego przeglądu w zakresie, którego dotyczy.

Werdykt **zatwierdzone** razem z zielonymi kontrolami dla tego samego commita wystarcza do integracji. Nie wymaga dodatkowej zgody człowieka.

## Kryteria zakończenia

- Przegląd wykonał niezależny recenzent bez dostępu do uzasadnień autora.
- Głębokość przeglądu odpowiadała rodzajowi i ryzyku zmiany.
- Zmiany zachowania sprawdzono w uruchomionej aplikacji lub testach.
- Uwagi mają kategorie i opierają się na kryteriach, standardach lub konkretnym ryzyku.
- Uwagi blokujące są poprawione albo rozstrzygnięte według zasad rozstrzygania sporów.
- Werdykt dotyczy aktualnego commita.
