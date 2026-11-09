# Standard budowy interfejsu (frontend) dla agentów AI

Wersja: 1.2.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard przy tworzeniu i zmianie interfejsu użytkownika aplikacji webowej. Dokument określa, jak budować widoki i komponenty: spójność wyglądu, podejście mobile first, komponenty i style, dostępność, formularze, stany ekranów, komunikację z API, teksty, SEO i wydajność.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasady nadrzędne

- **Spójność przed dosłownością.** Makieta nie musi być odwzorowana w 100%. Wymagane jest, aby interfejs był spójny: elementy tego samego rodzaju wyglądają i działają tak samo w całej aplikacji.
- **Mobile first.** Interfejs projektuj i buduj najpierw dla telefonów, potem rozszerzaj na większe ekrany. Wyjątek: projekt istniejący, który przyjął inne podejście.
- **Zero błędów.** Interfejs nie generuje błędów ani ostrzeżeń w konsoli przeglądarki, w buildzie i w narzędziach analizy. Każde takie zgłoszenie jest błędem do naprawy. W projekcie istniejącym, który już zgłasza błędy lub ostrzeżenia, zmiana nie dodaje nowych, a istniejące zgłoś osobno.
- **Lekko w granicach rozsądku.** Aplikacja ma być szybka i lekka, bez optymalizacji, które komplikują kod bez wyraźnego zysku.

## Spójność wyglądu

- Wartości wizualne definiuj raz, jako tokeny: kolory, odstępy, typografię, zaokrąglenia, obramowania, cienie, czasy animacji. Komponenty korzystają wyłącznie z tokenów, nie z wartości wpisanych na stałe.
- Każdy rodzaj elementu, np. przycisk, pole formularza, karta, komunikat, ma jedną definicję z wariantami, np. `primary`, `secondary`, `danger`. Nie twórz kopii elementu z drobnymi różnicami, np. przycisku z innym obramowaniem.
- Przed utworzeniem nowego komponentu sprawdź, czy istniejący komponent lub jego wariant nie rozwiązuje potrzeby.
- W istniejącym projekcie stosuj jego komponenty, tokeny i wzorce. Zadanie nie musi opisywać wyglądu elementów, które już mają wzorzec.
- Gdy makieta lub zadanie nie określa elementu, np. stanu błędu, widoku mobilnego, rzadkiego przypadku, zbuduj go z istniejących komponentów i tokenów, na wzór podobnych widoków. Wymień takie elementy w raporcie.
- Gdy brakuje projektu całego nowego widoku i nie ma w aplikacji podobnego wzorca, zbuduj go z istniejących komponentów i tokenów według powszechnie przyjętych wzorców UX dla danego rodzaju widoku, np. listy, formularza, panelu ustawień. Wymień widok w raporcie jako zaprojektowany przez agenta, do sprawdzenia na stagingu.

## Mobile first i responsywność

- Style bazowe dotyczą najmniejszych ekranów. Większe ekrany obsługuj zapytaniami `min-width`.
- Używaj układów elastycznych, np. flexbox, grid, jednostek względnych. Unikaj stałych szerokości, które wymuszają przewijanie w poziomie.
- Elementy dotykowe mają co najmniej 44 × 44 px obszaru aktywnego.
- Nie ukrywaj na telefonach funkcji dostępnych na komputerze, chyba że projekt tak określa.
- Uwzględniaj obszary bezpieczne ekranu, orientację i klawiaturę ekranową przy formularzach.

## Komponenty i style

- **Mały projekt**, np. kilka prostych widoków: buduj minimalny własny zestaw komponentów, bez rozbudowanych bibliotek UI.
- **Średni lub duży projekt:** opieraj się na uznanej bibliotece komponentów właściwej dla frameworka i dostosuj ją do tokenów projektu. Nie buduj od zera komponentów, które biblioteka dostarcza, np. okna dialogowego, listy rozwijanej, kalendarza.
- Sposób stylowania wybierz najlepiej dopasowany do frameworka i projektu, jeśli dokumentacja lub zadanie go nie wskazują. W projekcie stosuj jeden sposób stylowania; nie mieszaj kilku.
- Nie stosuj stylów wpisanych bezpośrednio w elementy, z wyjątkiem wartości wyliczanych dynamicznie.
- Komponent ma jedną odpowiedzialność. Oddzielaj komponenty prezentacyjne od logiki pobierania danych i stanu, jeśli upraszcza to kod i testy.

## Dostępność

- Celem jest zgodność z WCAG 2.2 na poziomie AA, wymaganym w praktyce w UE dla wielu usług cyfrowych.
- Stosuj semantyczny HTML: właściwe nagłówki w kolejności, `button` dla akcji, `a` dla nawigacji, `label` dla pól, listy, tabele, obszary `main`, `nav`, `header`, `footer`.
- Wszystkie funkcje są dostępne z klawiatury, w logicznej kolejności, z widocznym fokusem.
- Kontrast tekstu wynosi co najmniej 4,5:1, a dużego tekstu i elementów interfejsu co najmniej 3:1.
- Informacja nie jest przekazywana wyłącznie kolorem, np. błąd pola ma także tekst lub ikonę.
- Obrazy mają tekst alternatywny; obrazy dekoracyjne mają pusty `alt`.
- Atrybuty ARIA stosuj tylko tam, gdzie semantyczny HTML nie wystarcza.
- Szanuj ustawienie `prefers-reduced-motion`.

## Formularze

- Walidacja we frontendzie służy wygodzie użytkownika. Walidacja na serwerze jest zawsze wymagana i rozstrzyga o poprawności danych.
- Reguły walidacji frontendu są zgodne z regułami backendu. Jeśli to możliwe, wyprowadzaj je ze wspólnego kontraktu, np. specyfikacji OpenAPI.
- Błędy pokazuj przy polu, którego dotyczą, w zrozumiałym języku, powiązane z polem dla czytników ekranu. Błędy zwrócone przez serwer przypisuj do właściwych pól.
- Po błędzie zachowuj wprowadzone dane.
- Blokuj ponowne wysłanie formularza w trakcie przetwarzania i pokazuj, że trwa wysyłanie.
- Stosuj właściwe typy pól i atrybuty, np. `type="email"`, `inputmode`, `autocomplete`, aby ułatwić wypełnianie na telefonie.

## Stany widoków

- Każdy widok i komponent z danymi ma obsłużone stany: ładowanie, brak danych, błąd i sukces.
- Ładowanie pokazuj bez przesuwania układu, np. szkieletem treści o docelowych wymiarach.
- Stan błędu wyjaśnia, co się stało, i daje możliwość ponowienia, jeśli ma to sens.
- Stan pusty informuje, że danych nie ma, i wskazuje możliwe działanie.
- Nie zostawiaj pustego ekranu ani nieobsłużonego błędu żądania.

## Komunikacja z API

- Typy żądań i odpowiedzi generuj ze specyfikacji API, np. OpenAPI, zamiast pisać je ręcznie. Dzięki temu frontend i backend korzystają z tego samego kontraktu.
- Wywołania API umieszczaj w jednej warstwie klienta API, nie bezpośrednio w komponentach.
- Obsługuj błędy sieci, przekroczenie czasu, brak uprawnień i wygaśnięcie sesji w jednym miejscu.
- W średnich i dużych projektach do pobierania i buforowania danych używaj uznanej biblioteki zamiast własnego mechanizmu.

## Teksty i tłumaczenia

- **Projekt jednojęzyczny, bez planu kolejnych języków:** teksty mogą być bezpośrednio w komponentach, bez biblioteki tłumaczeń. Powtarzalne komunikaty, np. błędy walidacji, statusy, etykiety akcji, trzymaj w jednym module.
- **Projekt wielojęzyczny lub z planowanymi kolejnymi językami:** od początku stosuj bibliotekę tłumaczeń i trzymaj wszystkie teksty w plikach tłumaczeń. Późniejsze przenoszenie tekstów jest kosztowne.
- Daty, liczby i kwoty formatuj zawsze według ustawień regionalnych, np. przez `Intl`, nie ręcznie.

## SEO i czytelność dla botów oraz agentów AI

- Strony publiczne, np. strona główna, opisy, artykuły, cennik, renderuj po stronie serwera lub statycznie. Ich treść musi być dostępna w HTML bez wykonywania JavaScriptu.
- Część aplikacji dostępna po zalogowaniu może działać jako aplikacja kliencka.
- Każda strona publiczna ma unikalny `title`, `meta description`, adres kanoniczny i metadane udostępniania, np. Open Graph.
- Stosuj dane strukturalne `JSON-LD` według schema.org tam, gdzie opisują treść strony, np. organizacja, produkt, artykuł, FAQ.
- Udostępniaj `sitemap.xml` i `robots.txt`. Adresy URL są czytelne i stałe.
- Semantyczny HTML i dostępność ułatwiają też odczyt treści i obsługę strony przez agentów AI. Nie ukrywaj treści ani akcji za elementami, które nie mają semantyki ani etykiet.

## Wydajność

- Dla stron publicznych dąż do dobrych wartości Core Web Vitals: LCP do 2,5 s, INP do 200 ms, CLS do 0,1.
- Obrazy dostarczaj w nowoczesnych formatach, np. WebP lub AVIF, w rozmiarach dopasowanych do ekranu, z określonymi wymiarami i leniwym ładowaniem poza pierwszym widokiem.
- Dziel kod według tras i ładuj ciężkie komponenty dopiero wtedy, gdy są potrzebne.
- Kontroluj rozmiar paczki JavaScript. Nie dodawaj dużej biblioteki dla małej funkcji.
- Czcionki ograniczaj do potrzebnych krojów i wag, z `font-display: swap`.

## Kryteria zakończenia

- Elementy tego samego rodzaju mają jedną definicję i korzystają z tokenów; brak lokalnych odstępstw wizualnych.
- Widoki działają najpierw na telefonie, a układ poprawnie rozszerza się na większe ekrany.
- Elementy niezdefiniowane w makiecie zbudowano z istniejących komponentów i wymieniono w raporcie.
- Interfejs spełnia wymagania dostępności WCAG 2.2 AA w zakresie zmiany.
- Formularze mają walidację zgodną z backendem, czytelne błędy przy polach i ochronę przed podwójnym wysłaniem.
- Widoki z danymi obsługują stany ładowania, braku danych, błędu i sukcesu.
- Typy API pochodzą ze wspólnego kontraktu; wywołania są w warstwie klienta API.
- Strony publiczne mają treść w HTML, metadane i dane strukturalne.
- Konsola, build i narzędzia analizy nie zgłaszają błędów ani ostrzeżeń wprowadzonych przez zmianę.
