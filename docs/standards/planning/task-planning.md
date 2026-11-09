# Standard planowania zadań dla agentów AI

Wersja: 1.0.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard po zamknięciu bramki wejścia, gdy materiały projektu lub zlecenia są kompletne. Dokument określa, jak dzielić pracę na iteracje i zadania, w jakiej kolejności je realizować, jak zapisać zadanie i kiedy zadanie jest gotowe do realizacji.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasada nadrzędna

Każde zadanie musi dać się zrealizować bez pytań. Zadanie dostaje status `READY` dopiero wtedy, gdy spełnia definicję zadania kompletnego. Development sprawdza tylko ten status i istnienie wskazanych materiałów, więc ocena kompletności odbywa się raz, tutaj.

## Iteracje

- Iteracja to grupa zadań, która kończy się działającą wersją aplikacji na stagingu, możliwą do obejrzenia przez użytkownika.
- **Nowy projekt:**
  - **iteracja 0, fundament:** szkielet aplikacji, środowisko lokalne, CI, pusta aplikacja na stagingu;
  - **iteracja 1:** najmniejszy przepływ działający od początku do końca, np. rejestracja, logowanie i jedna kluczowa funkcja w najprostszej formie;
  - **kolejne iteracje:** rozbudowa funkcji według zakresu pierwszej wersji.
- **Istniejący projekt:** zlecenie to zwykle jedna iteracja. Pierwsze w niej są zadania naprawy uruchomienia lub kontroli wskazane przez bramkę wejścia.
- Iteracja ma krótki cel w jednym zdaniu, np. „Klient może anulować zamówienie przed wysyłką”.

## Podział na zadania

- Dziel pracę na pionowe plastry: zadanie dostarcza jedną funkcję widoczną dla użytkownika, przekrojowo przez wszystkie potrzebne warstwy, np. bazę, API i interfejs. Nie dziel pracy na zadania według warstw, np. osobno „backend” i „frontend”.
- Zadanie spełnia kryteria INVEST:
  - **niezależne:** można je zrealizować i zintegrować bez czekania na zadania spoza jego zależności;
  - **wartościowe:** po integracji użytkownik lub system zyskuje coś działającego;
  - **małe:** mieści się w jednym PR, który recenzent oceni w całości;
  - **testowalne:** ma scenariusze, z których powstają testy.
- Zadanie za duże dziel według:
  - scenariuszy: najpierw główny przepływ, potem przypadki alternatywne i brzegowe;
  - ról: najpierw jedna rola, potem kolejne;
  - operacji: np. dodanie i odczyt przed edycją i usuwaniem;
  - wariantów danych: np. jedna waluta przed wieloma.
- Zadania techniczne bez funkcji widocznej dla użytkownika twórz tylko wtedy, gdy są konieczne, np. fundament projektu, kolejne etapy migracji expand/contract, aktualizacja frameworka.

## Zadanie, PR i commity

- Jedno zadanie to jeden PR.
- Jeden PR zawiera wiele commitów. Commity dzielisz według standardu pracy z Git: każdy commit ma jeden cel i jeden obszar, więc zmiany backendu i frontendu są w osobnych commitach tego samego PR.
- Kolejność commitów w zadaniu przekrojowym: najpierw zgodne wstecz rozszerzenie API, potem jego użycie we frontendzie.
- Pionowy plaster dotyczy zadania i PR, a rozdział obszarów dotyczy commitów. Te zasady się uzupełniają: zadanie dostarcza całą funkcję, a historia pozostaje czytelna według obszarów.

## Kolejność i priorytety

- Każde zadanie ma priorytet: `highest`, `high`, `medium`, `low` albo `lowest`. Domyślny priorytet to `medium`. Priorytet może ustawić użytkownik albo opis projektu.
- Agent ustala kolejność samodzielnie, według reguł w tej kolejności:
  1. zależności: zadanie realizujesz po zadaniach, od których zależy;
  2. priorytet: wyższy przed niższym;
  3. ryzyko: przy równym priorytecie najpierw zadania z większą niepewnością, np. nowa integracja, aby problemy wyszły wcześnie;
  4. wartość: przy równym ryzyku najpierw zadania, które szybciej dają działającą funkcję.
- Zadania bez wzajemnych zależności mogą być realizowane równolegle.

## Scenariusze i kryteria akceptacji

- Zadanie ma wyraźny podział na scenariusze. Każdy scenariusz opisuje jedną sytuację użytkownika lub systemu.
- Kryteria scenariusza zapisuj w formie „Gdy… wtedy…”: warunek i obserwowalny wynik.
- Każde zadanie ma co najmniej jeden scenariusz negatywny, np. brak uprawnień, błędne dane, niedozwolony stan.
- Każde kryterium da się sprawdzić testem. Unikaj sformułowań nieobserwowalnych, np. „działa szybko”, „jest intuicyjne”; zastępuj je wartością lub zachowaniem.

## Plik zadania

- Każde zadanie to plik Markdown w `docs/tasks/`, nazwany identyfikatorem i krótkim opisem, np. `TASK-142-order-cancellation.md`.
- Identyfikatory zadań numeruj kolejno w projekcie, np. `TASK-142`, a iteracji: `ITER-04`. Jeśli projekt korzysta z zewnętrznego systemu zadań, stosuj jego identyfikatory.
- Treść pliku jest po angielsku, zgodnie z dokumentacją techniczną.

```markdown
---
id: TASK-142
title: Order cancellation
status: READY
priority: medium
iteration: ITER-04
depends_on: [TASK-140]
areas: [api, client]
materials:
  - docs/product/orders.md#cancellation
  - docs/design/order-details.png
  - docs/api/openapi.yaml
---

## Goal
Customers can cancel an order before it is shipped.

## Scope
- Cancel action on the order details view.
- Refund of the payment through the payment provider.

## Out of scope
- Partial cancellation of order items.

## Scenarios

### Scenario 1: Cancellation before shipment
- When the customer cancels an order with status "paid", then the order status is "cancelled" and a full refund is requested.
- When the refund request succeeds, then the customer sees a confirmation.

### Scenario 2: Cancellation after shipment (negative)
- When the customer tries to cancel a shipped order, then the cancellation is rejected with a message that it is no longer possible.

## Technical notes
Optional. Only facts the agent cannot derive from the project, e.g. a provider limitation.

## Report
Filled in by development after the task.
```

## Statusy zadań

| Status | Znaczenie | Kto ustawia |
|---|---|---|
| `PROPOSED` | Zadanie zaproponowane przez agenta podczas pracy, np. istotny błąd lub usprawnienie poza zakresem | development |
| `READY` | Zadanie spełnia definicję zadania kompletnego | planowanie |
| `IN_PROGRESS` | Zadanie w realizacji | development |
| `BLOCKED` | Realizacja zatrzymana; powód w raporcie | development |
| `DONE` | Zadanie zintegrowane z gałęzią główną | development |

- Zadanie `PROPOSED` wchodzi do planu, gdy użytkownik je włączy albo gdy opis projektu określa, które propozycje włączać automatycznie, np. poprawki bezpieczeństwa. Wtedy planowanie uzupełnia je do definicji zadania kompletnego i nadaje status `READY`.
- Agent wymienia otwarte propozycje w zgłoszeniu gotowości do wdrożenia.

## Definicja zadania kompletnego

Zadanie dostaje status `READY` tylko wtedy, gdy spełnia wszystkie warunki:

- ma jednozdaniowy cel;
- ma zakres i jawną listę tego, co jest poza zakresem;
- ma scenariusze z kryteriami „Gdy… wtedy…”, w tym co najmniej jeden negatywny;
- wskazuje materiały, z których korzysta, np. opis produktu, makiety, kontrakt API, a wskazane materiały istnieją;
- nie zależy od żadnego otwartego braku blokującego z bramki wejścia;
- ma rozstrzygnięte typowe braki z bramki wejścia, które go dotyczą, np. uprawnienia, istniejące dane, powiadomienia;
- jego zależności mają status `DONE` albo są wcześniej w kolejności tej samej iteracji;
- mieści się w jednym PR;
- ma priorytet, iterację i listę obszarów.

## Zmiany w trakcie

- Gdy zmieniają się materiały, np. opis produktu lub makieta, zadania, które z nich korzystają, a nie są jeszcze `DONE`, wracają do planowania. Planowanie ponownie sprawdza definicję zadania kompletnego.
- Zadania `DONE` nie zmieniaj. Zmianę zrealizowanej funkcji opisz nowym zadaniem.

## Integracja z systemem zadań

Pliki zadań mają budowę, którą można przenieść do zewnętrznego systemu, np. Jira lub GitHub Issues, bez zmiany treści.

| Pole pliku | Jira | GitHub Issues |
|---|---|---|
| `id` | klucz zgłoszenia, np. `WAL-142` | numer zgłoszenia |
| `title` | Summary | Title |
| `status` | status w workflow projektu | stan i etykieta |
| `priority` | Priority: Highest, High, Medium, Low, Lowest | etykieta priorytetu |
| `iteration` | Sprint | Milestone |
| `depends_on` | powiązanie „is blocked by” | odwołanie w treści lub sub-issue |
| `areas` | Components lub Labels | etykiety |
| treść: cel, zakres, scenariusze | Description | treść zgłoszenia |

- Projekt ma jedno źródło prawdy dla zadań: pliki w repozytorium albo zewnętrzny system. Opis projektu wskazuje, które.
- Gdy źródłem prawdy jest zewnętrzny system, agent czyta i aktualizuje zadania przez jego API lub oficjalną integrację, a pliki w `docs/tasks/` nie powstają albo są tylko kopią tylko do odczytu.
- Nie twórz pól, których nie da się odwzorować w typowym systemie zadań.

## Kryteria zakończenia

- Praca jest podzielona na iteracje, a każda kończy się działającą wersją na stagingu.
- Zadania są pionowymi plastrami spełniającymi INVEST; zadania techniczne występują tylko tam, gdzie są konieczne.
- Każde zadanie to jeden PR; podział na commity według obszarów pozostaje zgodny ze standardem pracy z Git.
- Każde zadanie ma priorytet, domyślnie `medium`, a kolejność wynika z zależności, priorytetu, ryzyka i wartości.
- Zadania mają scenariusze „Gdy… wtedy…” z co najmniej jednym scenariuszem negatywnym.
- Pliki zadań mają ustaloną budowę, możliwą do przeniesienia do Jira lub GitHub Issues.
- Status `READY` mają tylko zadania spełniające definicję zadania kompletnego.
