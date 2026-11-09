# Standard realizacji zadania dla agentów AI

Wersja: 2.5.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard od otrzymania zadania do raportu: przy nowej funkcji, naprawie błędu, refaktoryzacji i zmianie konfiguracji, zarówno w nowym, jak i w istniejącym projekcie. Dokument określa, jak agent sprawdza zadanie, podejmuje decyzje, pilnuje zakresu, rozwiązuje problemy i raportuje.

Zadanie przychodzi z etapu planowania. Planowanie odpowiada za kompletność wymagań i podział pracy na zadania; ten standard odpowiada za realizację jednego zadania.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasada nadrzędna

Realizuj zadanie samodzielnie i w całości, bez zatwierdzania planu. Decyzje bierz ze źródeł projektu i standardów, a gdy ich brak, z powszechnie przyjętych praktyk. Pytaj wyłącznie o istotną decyzję produktową, której nie rozstrzyga żadne źródło, i zawsze z kompletną propozycją.

## Źródła decyzji

Każdą decyzję bierz z pierwszego źródła, które ją rozstrzyga:

1. zadanie i jego kryteria akceptacji;
2. dokumentacja projektowa, np. `docs/product/`, `docs/design/`;
3. instrukcje projektu z profilem technicznym, np. `AGENTS.md`;
4. zapisane decyzje, np. `docs/decisions/`;
5. kod najbliższy zmianie: istniejący wzorzec w aplikacji;
6. standardy;
7. powszechnie przyjęte praktyki: oficjalna dokumentacja języka i frameworka, uznane wzorce projektowe i wzorce UX.

Brak rozstrzygnięcia w źródłach 1–4 nie jest powodem do pytania, jeśli rozstrzyga je źródło 5, 6 lub 7.

## Sprawdzenie zadania

Przed implementacją przeczytaj zadanie, instrukcje projektu z profilem technicznym, dokumentację projektową, której zadanie dotyczy, i powiązany kod. Następnie sprawdź dwie rzeczy: czy plik zadania ma status `READY` i czy materiały wskazane w zadaniu istnieją. Status `READY` nadaje planowanie po sprawdzeniu definicji zadania kompletnego; nie oceniaj jej ponownie.

- **Zadanie `READY` z istniejącymi materiałami:** realizuj je od początku do końca.
- **Zadanie bez statusu `READY` albo z brakującym materiałem:** przekaż je z powrotem do planowania, ze wskazaniem braku.
- **Zadanie bez planowania**, np. przekazane bezpośrednio w poleceniu: najpierw zaplanuj je według standardu planowania zadań, a potem realizuj.
- **Projekt bez profilu technicznego:** najpierw utwórz profil według standardu planowania, a potem realizuj zadanie.
- **Brakuje istotnej decyzji produktowej:** zgłoś braki w jednej wiadomości, z propozycją uzupełnienia każdego z nich. Nie implementuj części zależnych od braków; części niezależne realizuj.
- **Zadanie jest za duże na jeden spójny PR:** podziel je na kolejne zadania według standardu planowania zadań i realizuj je po kolei.

Szczegóły techniczne, które rozstrzygają standardy i konwencje projektu, nie są brakiem.

## Decyzje w trakcie pracy

- **Zastane rozwiązania obowiązują.** W istniejącym projekcie stosuj rozwiązania techniczne, które zastałeś, np. bazę danych, framework, styl API, narzędzia, nawet jeśli różnią się od standardów. Ich zmiana to osobne zadanie.
- **Ustalanie zastanego rozwiązania.** Nie analizuj całego kodu. Postępuj kolejno:
  1. sprawdź profil techniczny projektu; jeśli rozstrzyga sprawę, zastosuj go;
  2. jeśli profil jej nie obejmuje, sprawdź tylko kod najbliższy zmianie: zmieniany moduł albo jeden analogiczny przypadek, wskazany przez mapę kodu lub znaleziony wyszukiwaniem po konkretnym wzorcu;
  3. jeśli w projekcie nie ma takiego przypadku, zastosuj standard;
  4. ustalenie z kroku 2 lub 3 dopisz do profilu technicznego, aby nie szukać go ponownie.
- **Decyzje techniczne** podejmuj samodzielnie. Wybierz wariant zgodny ze standardami i konwencjami projektu. Gdy kilka wariantów jest zgodnych, wybierz prostszy i łatwiejszy do późniejszej zmiany.
- Decyzję nietypową lub o długoterminowych skutkach zapisz zgodnie ze standardem dokumentacji i wymień w raporcie.
- **Drobne decyzje produktowe** podejmuj samodzielnie, według istniejących wzorców aplikacji i powszechnie przyjętych praktyk UX, np. treść komunikatu, domyślne sortowanie, potwierdzenie operacji nieodwracalnej, wygląd elementu zbudowanego z istniejących komponentów. Wymień je w raporcie, aby użytkownik mógł je sprawdzić na stagingu.
- **Istotne decyzje produktowe** należą do użytkownika: nowa lub zmieniona reguła biznesowa, zmiana zachowania, na którym polegają użytkownicy, sprawy pieniędzy, prawne i danych osobowych, koszt płatnej usługi. Jeśli żadne źródło ich nie rozstrzyga, zapytaj.
- Nie wykraczaj poza zakres zadania ani nie odstępuj od standardów. Jeśli zadania nie da się zrealizować bez tego, zatrzymaj zależną część i zgłoś sytuację z propozycją rozwiązania.

## Sposób zadawania pytań

1. Zbierz wszystkie wątpliwości i zadaj je naraz, w jednej wiadomości.
2. Przedstaw kompletną propozycję z rekomendowanym wariantem i krótkim uzasadnieniem. Użytkownik ma móc odpowiedzieć „tak” albo zgłosić uwagi do wybranych punktów.
3. Przy realnych wariantach pokaż je obok siebie: na czym polegają, zalety i konsekwencje, rekomendacja.
4. Nie pytaj o szczegóły techniczne. Rozstrzygnij je sam według standardów.
5. Nie pytaj ponownie o sprawy już rozstrzygnięte w zadaniu, dokumentacji lub wcześniejszej odpowiedzi.

## Problemy znalezione poza zakresem

- **Drobny błąd** napraw od razu, w osobnym commicie, i wymień go w raporcie.
- **Istotny błąd** nie naprawiaj w ramach zadania. Zapisz go jako propozycję nowego zadania ze statusem `PROPOSED` w miejscu wskazanym przez projekt, domyślnie w `docs/tasks/`, wymień w raporcie i kontynuuj zadanie. Jeśli błąd blokuje zadanie, postępuj jak przy problemie, którego nie da się rozwiązać.
- Błąd jest drobny tylko wtedy, gdy spełnia wszystkie warunki:
  - poprawka jest lokalna i oczywista, np. literówka, błędny warunek w jednym miejscu, nieużywany import;
  - nie zmienia kontraktu API, modelu danych, uprawnień ani zachowania, na którym mogą polegać inne części systemu lub użytkownicy;
  - nie dotyczy bezpieczeństwa, płatności, danych osobowych ani migracji;
  - można ją zweryfikować istniejącymi testami lub prostym nowym testem.
- W razie wątpliwości traktuj błąd jako istotny. Pozornie mały błąd może mieć duże skutki.
- Refaktoryzację i usprawnienia niebędące naprawą błędu zapisuj jako propozycje nowych zadań, a nie wykonuj.

## Rozwiązywanie problemów

1. Gdy coś nie działa, rozwiązuj problem samodzielnie: ustal przyczynę, sformułuj hipotezę i sprawdź ją.
2. Każda kolejna próba wymaga nowej hipotezy lub nowych informacji. Samo ponowienie tej samej czynności nie jest nową próbą.
3. Po 3 nieskutecznych próbach rozwiązania tego samego problemu zatrzymaj się i zgłoś problem: co próbowano, co zaobserwowano, jakie są hipotezy i czego potrzeba.
4. Kontynuuj części zadania niezależne od problemu.
5. Gdy wymaganie okazuje się sprzeczne lub niewykonalne, zatrzymaj zależną pracę i przedstaw sytuację z propozycją rozwiązania. Nie zmieniaj wymagań ani kryteriów akceptacji samodzielnie.

## Przerwanie i wznowienie

- Przy zadaniu, którego nie da się ukończyć w jednej sesji, zapisuj krótki stan pracy w miejscu wskazanym przez projekt, a jeśli go nie wskazuje, w pliku zadania.
- Stan pracy zawiera: cel, wykonane kroki, bieżący krok, otwarte pytania, niezapisane zmiany i następną czynność.
- Po wznowieniu najpierw odtwórz stan z zapisu, repozytorium i statusu zadania. Nie zakładaj, że wcześniejsze ustalenia są aktualne bez sprawdzenia.

## Raport

Aktualizuj status zadania: `IN_PROGRESS` przy rozpoczęciu, `BLOCKED` przy zatrzymaniu, z powodem w raporcie, `DONE` po integracji z gałęzią główną.

Zapisz raport w pliku zadania, a w wiadomości podaj jego skrót. Raport jest krótki i zawiera tylko:

- co zostało zrobione, z perspektywy celu zadania;
- status kryteriów akceptacji;
- utworzone commity, PR i wynik integracji;
- zapisane decyzje techniczne;
- naprawione drobne błędy poza zakresem i propozycje nowych zadań;
- zgłoszone problemy, ograniczenia i pominięte kontrole;
- drobne decyzje produktowe podjęte samodzielnie, do sprawdzenia na stagingu;
- pytania o istotne decyzje produktowe, jeśli są.

Nie opisuj przebiegu pracy krok po kroku. Nie deklaruj wyższego stopnia ukończenia, niż wynika z weryfikacji.

## Kryteria zakończenia

- Przed implementacją sprawdzono status `READY` i istnienie materiałów; zadanie bez planowania zostało najpierw zaplanowane.
- Status zadania odpowiada stanowi pracy.
- Decyzje techniczne podjęto samodzielnie, na podstawie profilu technicznego, bez analizy całego kodu; nietypowe są zapisane, a nowe ustalenia dopisane do profilu.
- Decyzje pochodzą ze źródeł w ustalonej kolejności; drobne decyzje produktowe podjęto samodzielnie i wymieniono w raporcie.
- Pytania dotyczyły wyłącznie istotnych decyzji produktowych, były zebrane w jednej wiadomości, z kompletną propozycją i rekomendacją.
- Drobne błędy poza zakresem są naprawione osobno; istotne błędy i usprawnienia zapisano jako propozycje zadań.
- Problemy nierozwiązane po 3 próbach są zgłoszone z diagnozą.
- Przerwane zadanie ma zapisany stan pozwalający kontynuować pracę bez zgadywania.
- Raport jest zapisany w pliku zadania, krótki i rzetelny.
