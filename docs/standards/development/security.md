# Standard bezpieczeństwa kodu dla agentów AI

Wersja: 1.4.0  
Data: 2026-11-09

## Zakres i stosowanie

Stosuj ten standard przy pisaniu i zmianie kodu, który przetwarza dane wejściowe, uwierzytelnia użytkowników, kontroluje dostęp, przechowuje dane osobowe, obsługuje sekrety lub udostępnia API. Dokument określa, jak budować zabezpieczenia w kodzie i konfiguracji aplikacji.

Wszystkie zasady są domyślne. Opis projektu, instrukcja współpracy lub polecenie użytkownika mogą je nadpisać; wtedy stosuj nadpisanie w jego zakresie.

Stosuj wersję dołączoną do projektu. Nie pobieraj automatycznie nowszej wersji ani nie zmieniaj tego standardu podczas realizacji zadania. Konflikt zasad rozstrzygaj według pierwszeństwa: polecenie użytkownika, zadanie, instrukcje projektu, standardy. Przy konflikcie między standardami wybierz rozwiązanie bezpieczniejsze dla danych i użytkowników, a rozstrzygnięcie opisz w raporcie.

## Zasady nadrzędne

- **Bezpieczeństwo ma pierwszeństwo przed wygodą i szybkością realizacji.** Konwencje projektu nie usprawiedliwiają podatności.
- **Domyślnie zabronione.** Dostęp, dane i operacje są niedostępne, dopóki kod jawnie na nie nie zezwoli.
- **Nie ufaj klientowi.** Frontend, aplikacja mobilna i każdy klient API mogą zostać obejściem. Każde zabezpieczenie działa po stronie serwera.
- **Mniej znaczy bezpieczniej.** Zbieraj, przechowuj, zwracaj i loguj tylko dane niezbędne do działania funkcji.
- **Stosuj sprawdzone rozwiązania.** Używaj mechanizmów frameworka i uznanych bibliotek. Nie implementuj własnej kryptografii, hashowania haseł ani obsługi tokenów.

## Sekrety

- Nie commituj plików z sekretami, np. `.env`. Commituj tylko szablon, np. `.env.example`, z nazwami zmiennych i wartościami zastępczymi.
- Lokalnie wczytuj sekrety z pliku `.env` wykluczonego w `.gitignore`.
- W CI przechowuj sekrety w mechanizmie sekretów platformy, np. GitHub Actions Secrets, z podziałem na środowiska.
- Na serwerze dostarczaj sekrety jako zmienne środowiskowe lub sekrety platformy hostingowej. Jeśli projekt używa menedżera sekretów, np. Doppler, Infisical, HashiCorp Vault, AWS Secrets Manager, korzystaj z niego.
- Każde środowisko ma własne sekrety. Nie używaj sekretów produkcyjnych lokalnie ani w testach.
- Nie umieszczaj sekretów w kodzie, logach, komunikatach błędów, adresach URL, obrazach Docker ani w kodzie frontendu. Zmienne publiczne frontendu, np. z prefiksem `VITE_` lub `NEXT_PUBLIC_`, są jawne dla każdego użytkownika.
- Klucze i konta techniczne mają minimalne uprawnienia potrzebne do ich zadania.
- Brak sekretu, np. klucza API nowej integracji, nie wstrzymuje pracy. Lokalnie i w testach używaj atrap lub środowiska testowego dostawcy, dodaj zmienną do `.env.example` i wymień sekrety wymagane na stagingu i produkcji w raporcie. Nie proś o sekrety produkcyjne i nie przyjmuj ich w treści rozmowy.
- Sekret, który trafił do repozytorium, logu lub innego niezabezpieczonego miejsca, traktuj jako ujawniony: zgłoś to i zaproponuj rotację. Usunięcie go z historii nie wystarcza.

## Walidacja i spójność danych

- Waliduj wszystkie dane wejściowe na granicy systemu, mechanizmem właściwym dla frameworka, np. DTO z walidatorem, schemat Pydantic, Zod. Dotyczy to żądań HTTP, plików, wiadomości z kolejek, webhooków, odpowiedzi usług zewnętrznych i zmiennych środowiskowych.
- Waliduj według listy dozwolonych wartości: typ, format, długość, zakres i zbiór dopuszczalnych wartości. Odrzucaj nieznane pola zamiast je ignorować lub zapisywać.
- Nie przypisuj danych z żądania bezpośrednio do encji ani modelu (mass assignment). Mapuj jawnie tylko pola, które użytkownik może zmienić.
- Wartości wpływające na uprawnienia lub pieniądze wyznaczaj po stronie serwera, np. właściciel zasobu, rola, cena, rabat, status. Nie przyjmuj ich od klienta.
- Reguły biznesowe sprawdzaj w logice domeny lub aplikacji, niezależnie od walidacji formularza.

## Wstrzykiwanie i obsługa danych niezaufanych

- Zapytania do bazy wykonuj przez ORM lub zapytania parametryzowane. Nigdy nie sklejaj zapytań z danymi wejściowymi.
- Dane wyświetlane w HTML koduj przez mechanizm szablonów lub frameworka frontendu z automatycznym escapowaniem. Nie wstawiaj surowego HTML pochodzącego od użytkownika; jeśli jest konieczny, oczyść go uznaną biblioteką.
- Nie uruchamiaj poleceń systemowych z danymi wejściowymi. Jeśli jest to konieczne, przekazuj argumenty jako listę, bez powłoki.
- Ścieżki plików budowane z danych wejściowych ograniczaj do dozwolonego katalogu i normalizuj przed użyciem.
- Przy pobieraniu zasobów z adresów podanych przez użytkownika ograniczaj dozwolone hosty i blokuj adresy wewnętrzne (SSRF).
- Nie deserializuj niezaufanych danych mechanizmami, które mogą tworzyć dowolne obiekty, np. `unserialize` w PHP, `pickle` w Pythonie.

## Uwierzytelnianie

- Domyślnie stosuj tokeny JWT obsługiwane przez uznaną bibliotekę lub mechanizm frameworka.
- Token dostępowy jest krótkotrwały, np. 15 minut. Długotrwała sesja opiera się na tokenie odświeżającym.
- Token odświeżający jest jednorazowy i rotowany przy każdym użyciu. Serwer przechowuje informację o wydanych tokenach odświeżających, aby móc je unieważnić przy wylogowaniu, zmianie hasła lub podejrzeniu przejęcia.
- W aplikacji przeglądarkowej przechowuj token odświeżający w ciasteczku `HttpOnly`, `Secure`, `SameSite`. Token dostępowy trzymaj w pamięci aplikacji, nie w `localStorage`.
- Przy weryfikacji tokenu sprawdzaj podpis, stały algorytm (odrzucaj `none` i nieoczekiwane algorytmy), czas ważności, wystawcę i odbiorcę.
- Token zawiera tylko niezbędne dane, np. identyfikator użytkownika. Nie umieszczaj w nim danych osobowych ani wrażliwych; treść JWT jest czytelna dla każdego.
- Hasła hashuj algorytmem przeznaczonym do haseł, np. Argon2id lub bcrypt, przez mechanizm frameworka. Nigdy nie przechowuj haseł jawnie ani nie szyfruj ich odwracalnie.
- Tokeny jednorazowe, np. reset hasła, potwierdzenie adresu e-mail, są losowe, krótkotrwałe, jednorazowe i przechowywane w bazie jako skrót.

## Kontrola dostępu

- Sprawdzaj uprawnienia po stronie serwera przy każdym żądaniu, także gdy interfejs nie pokazuje danej funkcji.
- Sprawdzaj dostęp do konkretnego zasobu, a nie tylko do typu operacji. Użytkownik z prawem odczytu faktur może czytać tylko faktury, do których ma dostęp.
- Ograniczaj zapytania do danych użytkownika lub organizacji już na poziomie zapytania, np. filtr po właścicielu w repozytorium. Nie pobieraj wszystkiego, aby filtrować później.
- Stosuj centralny mechanizm uprawnień frameworka, np. Voters w Symfony, Policies w Laravel, zależności w FastAPI. Nie rozpraszaj warunków uprawnień po kontrolerach.
- Zwracaj tylko pola, które użytkownik może zobaczyć, przez jawny obiekt odpowiedzi (DTO, serializer z listą pól). Nie serializuj całych encji ani modeli. Dane ukryte w interfejsie, ale obecne w odpowiedzi API, są ujawnione.
- Funkcje administracyjne chroń osobnymi uprawnieniami i nie udostępniaj ich przez te same punkty końcowe bez kontroli roli.
- Dla każdego punktu końcowego z danymi użytkownika napisz test odmowy dostępu dla innego użytkownika i dla użytkownika bez uprawnień.

## Ochrona przed enumeracją i nadużyciami

- Logowanie, przypomnienie hasła i podobne procesy zwracają taki sam status HTTP, taką samą treść odpowiedzi i zbliżony czas odpowiedzi niezależnie od tego, czy adres e-mail lub login istnieje w systemie. Przykłady: „Nieprawidłowy e-mail lub hasło”, „Jeśli konto istnieje, wysłaliśmy wiadomość z instrukcją”.
- Rejestracja może informować, że konto z danym adresem już istnieje, i wskazywać logowanie oraz reset hasła. Ponieważ pozwala to sprawdzać istnienie adresów, chroń ją wzmocnionymi zabezpieczeniami: niskim limitem prób według adresu IP i urządzenia, weryfikacją przeciw botom, np. CAPTCHA, po przekroczeniu progu oraz monitorowaniem nietypowej liczby prób.
- Dla zasobu, do którego użytkownik nie ma dostępu, zwracaj taki sam wynik jak dla zasobu nieistniejącego, np. `404`, jeśli ujawnienie istnienia zasobu jest ryzykiem.
- Publiczne identyfikatory zasobów są nieprzewidywalne, np. UUID, a nie kolejne liczby. Nie zastępuje to kontroli dostępu.
- Stosuj limity żądań (rate limiting) dla logowania, rejestracji, resetu hasła, weryfikacji kodów, wysyłki wiadomości i kosztownych operacji: według adresu IP oraz według konta lub adresu e-mail.
- Po serii nieudanych prób logowania stosuj rosnące opóźnienie lub czasową blokadę.
- Eksport i operacje masowe są ograniczone uprawnieniami i limitami.

## Dane osobowe i wrażliwe

- Zbieraj tylko dane niezbędne do działania funkcji. Jeśli funkcja może działać bez danej lub z jej częścią, nie zbieraj jej w całości.
- Tam, gdzie dane nie są potrzebne w całości, stosuj maskowanie, np. ostatnie cyfry numeru, część adresu e-mail, w interfejsie, odpowiedziach API i raportach.
- Szczególnie wrażliwe dane szyfruj w bazie na poziomie pól, jeśli ich wyciek byłby poważny, np. numery dokumentów, dane zdrowotne.
- Projektuj model danych tak, aby dane osobowe można było usunąć lub zanonimizować bez naruszenia spójności pozostałych danych, np. przez wydzielenie danych osobowych i zastąpienie ich wartościami anonimowymi.
- Określ czas przechowywania danych osobowych i usuwaj lub anonimizuj je po jego upływie, jeśli projekt to przewiduje.
- Nie umieszczaj danych osobowych w logach, adresach URL, narzędziach analitycznych ani systemach raportowania błędów. Jeśli identyfikacja jest potrzebna do diagnozy, loguj identyfikator, a nie dane.

## Konfiguracja HTTP i API

- Aplikacja działa wyłącznie przez HTTPS, z nagłówkiem `Strict-Transport-Security`.
- Ustawiaj nagłówki bezpieczeństwa: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, ochronę przed osadzaniem w ramkach (`frame-ancestors`).
- CORS dopuszcza tylko jawnie wymienione domeny. Nie łącz `*` z obsługą poświadczeń.
- Gdy uwierzytelnianie korzysta z ciasteczek, stosuj ochronę CSRF.
- Ciasteczka z danymi sesji lub tokenami mają flagi `HttpOnly`, `Secure` i właściwe `SameSite`.
- Przesyłane pliki sprawdzaj pod kątem typu na podstawie zawartości i rozmiaru, zapisuj pod losowymi nazwami poza katalogiem publicznym i udostępniaj przez kontrolowany punkt końcowy.
- W środowisku produkcyjnym wyłącz tryb debugowania. Odpowiedzi błędów nie zawierają śladów stosu, zapytań ani ścieżek.
- Loguj zdarzenia bezpieczeństwa: nieudane logowania, odmowy dostępu, przekroczenia limitów, zmiany haseł i uprawnień, bez haseł, tokenów i danych osobowych.

## Zmiany zabezpieczeń poza zadaniem

Zmianę z poniższej listy wykonuj tylko wtedy, gdy zadanie wprost ją zleca i określa. W przeciwnym razie jej nie wykonuj, tylko zapisz jako propozycję nowego zadania z uzasadnieniem. Jeśli bez niej zadania nie da się zrealizować, zatrzymaj zależną część i zgłoś sytuację z propozycją rozwiązania.

- zmienia mechanizm uwierzytelniania, czas życia tokenów lub sposób ich przechowywania;
- zmienia model ról i uprawnień albo zasady dostępu do danych;
- osłabia lub wyłącza zabezpieczenie, np. CORS, CSP, CSRF, limity żądań, walidację;
- zmienia algorytmy kryptograficzne, hashowanie haseł lub klucze;
- zmienia sposób przechowywania i dostarczania sekretów;
- wprowadza zbieranie nowych danych osobowych lub przekazywanie danych do usług zewnętrznych;
- zmienia zasady przechowywania, usuwania lub anonimizacji danych osobowych.

## Kryteria zakończenia

- Sekrety nie trafiły do repozytorium, logów, obrazów ani kodu frontendu; szablon konfiguracji jest aktualny.
- Dane wejściowe są walidowane na granicy systemu; wartości wpływające na uprawnienia i pieniądze wyznacza serwer.
- Zapytania są parametryzowane, a dane wyjściowe kodowane.
- Uwierzytelnianie korzysta ze sprawdzonej biblioteki; tokeny są krótkotrwałe, rotowane i możliwe do unieważnienia.
- Dostęp jest sprawdzany na serwerze dla konkretnego zasobu; odpowiedzi zawierają tylko dozwolone pola; istnieją testy odmowy dostępu.
- Logowanie i reset hasła nie ujawniają istnienia adresów e-mail; rejestracja ma wzmocnione zabezpieczenia przed masowym sprawdzaniem adresów; wrażliwe punkty końcowe mają limity żądań.
- Dane osobowe są ograniczone do niezbędnych, maskowane tam, gdzie nie są potrzebne w całości, i możliwe do usunięcia lub anonimizacji.
- Konfiguracja HTTP stosuje HTTPS, nagłówki bezpieczeństwa i ścisły CORS; tryb debugowania jest wyłączony w produkcji.
- Zmiany zabezpieczeń z listy wykonano tylko wtedy, gdy zlecało je zadanie; pozostałe zapisano jako propozycje zadań.
