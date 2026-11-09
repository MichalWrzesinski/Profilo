# Standard wykorzystania AI w aplikacjach dla agentów AI

Wersja: 1.0.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard przy budowie funkcji aplikacji, które korzystają z modeli językowych (LLM) lub z własnych modeli uczenia maszynowego. Dokument określa wybór dostawcy i modelu, izolację, ochronę danych, koszty, bezpieczeństwo odpowiedzi, odporność na awarie, prompty, ocenę jakości i przejrzystość dla użytkowników.

Standard nie dotyczy agentów AI, którzy tworzą kod. Dotyczy AI jako części budowanej aplikacji.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasady nadrzędne

- **Odpowiedź modelu to dane niezaufane.** Traktuj ją jak dane od użytkownika: waliduj, nie wykonuj, nie wstawiaj bez kodowania.
- **Koszt pod kontrolą.** Każda funkcja z AI ma limity i znany koszt przy przewidywanej skali.
- **Jakość mierzona, nie zakładana.** Funkcja z AI ma zestaw ewaluacyjny i próg jakości jako kryterium akceptacji.
- **Działanie bez AI.** Każda funkcja z AI ma zdefiniowane zachowanie, gdy model jest niedostępny.

## Modele językowe

### Dostawca i model

- Domyślnym dostawcą jest OpenAI. Zmiana dostawcy to osobne zadanie.
- Wywołania dostawcy umieszczaj w adapterze za interfejsem, zgodnie ze standardem backendu. Reszta aplikacji nie zna szczegółów dostawcy.
- Korzystaj z oficjalnej biblioteki dostawcy.
- Dostępne modele, ich możliwości i ceny sprawdzaj w aktualnej dokumentacji dostawcy, nie z pamięci.
- Dla każdej funkcji wybierz najtańszy model, który spełnia próg jakości w ewaluacji. Mocniejszy model stosuj tylko tam, gdzie słabszy nie spełnia progu.
- Przypinaj konkretną wersję modelu. Zmiana modelu to osobne zadanie z uruchomieniem ewaluacji.

### Izolacja

- Wywołania modeli wykonuje wyłącznie backend. Klucz API nie trafia do frontendu, aplikacji mobilnej, repozytorium ani logów.
- Klucz ma tylko komponent, który wykonuje wywołania. Jeśli to możliwe, wywołania wykonuje osobny proces, np. zadanie w tle, a nie proces publicznego API.
- Użytkownik nie kontroluje instrukcji systemowych, wyboru modelu ani parametrów wywołania. Tekst od użytkownika trafia do modelu wyłącznie jako dane, w wyraźnie oddzielonej części wiadomości.
- Dokumentacja projektu może określić inny sposób izolacji.

### Dane wysyłane do dostawcy

- Wysyłaj tylko dane niezbędne do zadania. Dane osobowe usuwaj lub maskuj, jeśli nie są potrzebne do wyniku.
- Nie wysyłaj sekretów, haseł, tokenów ani danych uwierzytelniających.
- Korzystaj z dostawcy i planu, którego warunki nie pozwalają trenować modeli na danych przesyłanych przez API. Przy danych osobowych wymagana jest umowa powierzenia przetwarzania zgodna z RODO.
- Polityka prywatności aplikacji informuje o przekazywaniu danych do dostawcy AI.
- Nie loguj pełnej treści promptów i odpowiedzi zawierających dane użytkowników. Loguj identyfikator wywołania, model, liczbę tokenów, czas i koszt.

### Koszty i limity

- Stosuj limity wywołań na użytkownika i globalne, np. dzienne.
- Ograniczaj długość danych wejściowych i maksymalną długość odpowiedzi.
- Buforuj wyniki identycznych zapytań, gdy wynik nie zależy od użytkownika ani czasu.
- Ustaw alert przy przekroczeniu budżetu miesięcznego, np. w panelu dostawcy i w monitoringu aplikacji.
- Przy doborze technologii przygotuj szacunek miesięcznego kosztu AI przy przewidywanej skali.

### Bezpieczeństwo odpowiedzi

- Gdy aplikacja potrzebuje danych strukturalnych, żądaj odpowiedzi w zdefiniowanym schemacie, np. JSON Schema, i waliduj ją przed użyciem. Odpowiedź niezgodną ze schematem traktuj jako błąd.
- Nie wykonuj treści odpowiedzi jako kodu, zapytania ani polecenia. Nie wstawiaj jej jako surowego HTML; koduj ją jak każdą treść od użytkownika.
- Gdy model może wywoływać funkcje aplikacji (tools), aplikacja sprawdza uprawnienia użytkownika przy każdym wywołaniu. Model nie wykonuje działań o istotnych skutkach, np. płatności, usuwania danych, wysyłki wiadomości, bez potwierdzenia użytkownika.
- Zakładaj, że dane od użytkownika i treści z zewnątrz, np. dokumenty, strony, e-maile, mogą zawierać instrukcje dla modelu (prompt injection). Instrukcje systemowe nie polegają na tym, że model je zignoruje; ograniczenia egzekwuje aplikacja.

### Odporność na awarie

- Stosuj zasady integracji z usługami zewnętrznymi ze standardu backendu: limity czasu, ponowienia tylko bezpieczne, kontrolowany wynik zamiast błędu `500`.
- Zdefiniuj zachowanie funkcji bez AI, np. komunikat o chwilowej niedostępności, wersję uproszczoną lub wykonanie później w tle.
- Długie wywołania wykonuj w tle albo przesyłaj odpowiedź strumieniowo, aby użytkownik nie czekał bez informacji.

### Prompty

- Prompty są kodem: przechowuj je w plikach w repozytorium, w jednym miejscu, np. `prompts/`, i poddawaj przeglądowi jak kod.
- Prompt zawiera rolę modelu, zadanie, ograniczenia, format odpowiedzi i przykłady, jeśli poprawiają wynik.
- Nie składaj promptów z fragmentów rozproszonych po kodzie. Dane wstawiaj w jawnie oznaczone miejsca szablonu.

### Ocena jakości (ewaluacje)

- Każda funkcja z AI ma zestaw ewaluacyjny w repozytorium: przykładowe wejścia z oczekiwanymi cechami odpowiedzi, np. poprawna kategoria, obecność wymaganych pól, brak zakazanych treści.
- Zestaw obejmuje przypadki typowe, brzegowe i próby nadużycia, np. prompt injection.
- Uruchamiaj ewaluację przy każdej zmianie promptu, modelu lub parametrów, a nie przy każdym PR, ponieważ kosztuje.
- Próg jakości, np. odsetek poprawnych odpowiedzi, jest kryterium akceptacji zadania. Wynik ewaluacji wpisz do raportu zadania.
- Zwykłe testy automatyczne korzystają z atrapy dostawcy i nie wywołują prawdziwego modelu.

### Przejrzystość dla użytkowników

- Użytkownik wie, że rozmawia z AI, i wie, które treści wygenerowało AI, zgodnie z obowiązkami przejrzystości unijnego AI Act.
- Przy treściach, od których mogą zależeć decyzje użytkownika, informuj, że odpowiedź może zawierać błędy.

## Własne modele uczenia maszynowego

### Kiedy własny model

Stosuj własny model tylko wtedy, gdy dla konkretnego, powtarzalnego zadania, np. klasyfikacji, model językowy jest za drogi, za wolny lub za mało dokładny. Decyzję zapisz z porównaniem.

### Dane i ocena

- Podziel dane na zbiór treningowy i testowy przed treningiem. Zbiór testowy nie bierze udziału w treningu ani w doborze ustawień. Dobór ustawień wykonuj walidacją krzyżową na zbiorze treningowym.
- Gdy dane mają strukturę, np. wiele wiadomości jednego zgłoszenia lub kolejność w czasie, dziel je tak, aby powiązane rekordy były w jednym zbiorze, a przy danych czasowych chronologicznie.
- Porównuj model z prostym punktem odniesienia (baseline), np. zawsze najczęstszą klasą.
- Metryki z progiem są kryterium akceptacji zadania. Raport oceny zawiera metryki ogólne, metryki dla każdej klasy i przykłady błędów.
- Gdy model ma zwracać „nie wiem”, wybierz próg pewności na danych walidacyjnych i oceń także przykłady spoza znanych kategorii.

### Odtwarzalność i wersje

- Trening wykonuje skrypt w repozytorium, z ustalonym ziarnem losowości i przypiętymi wersjami bibliotek.
- Każdy wytrenowany model ma zapisaną wersję danych, np. skrót pliku, parametry i wyniki oceny.
- Duże pliki modeli i danych przechowuj poza Git, np. w magazynie plików projektu, z wersją w nazwie.
- Ponowny trening na nowych danych to osobne zadanie z porównaniem wyników do poprzedniej wersji.

### Bezpieczeństwo modeli

- Ładuj wyłącznie pliki modeli wytworzone przez własny trening. Formaty takie jak `pickle` i `joblib` mogą wykonać kod podczas odczytu.
- Dane treningowe nie zawierają danych osobowych, chyba że projekt na to pozwala i zostały zabezpieczone według standardu bezpieczeństwa.

## Kryteria zakończenia

- Wywołania modeli wykonuje tylko backend, przez adapter, z kluczem dostępnym tylko dla komponentu wywołującego.
- Model jest przypięty w wersji i jest najtańszym spełniającym próg jakości.
- Do dostawcy trafiają tylko niezbędne dane, bez sekretów; logi nie zawierają treści z danymi użytkowników.
- Funkcja ma limity, maksymalną długość wejścia i odpowiedzi oraz alert budżetu.
- Odpowiedzi strukturalne są walidowane schematem; treść odpowiedzi nie jest wykonywana ani wstawiana jako surowy HTML; działania o skutkach sprawdza aplikacja.
- Funkcja ma zdefiniowane zachowanie bez AI i kontrolowany wynik przy awarii dostawcy.
- Prompty są w repozytorium; ewaluacja z progiem jakości została uruchomiona, a wynik jest w raporcie.
- Użytkownik wie, że korzysta z AI.
- Własny model ma rozdzielone dane, baseline, metryki z progiem, odtwarzalny trening, wersjonowane artefakty i ładuje tylko własne pliki modeli.
