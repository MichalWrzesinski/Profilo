# User flows

Screens and transitions per role for version 1. Story and rule IDs refer to `docs/product/`.

## Visitor

```mermaid
flowchart LR
    L[Landing /] -->|Załóż stronę| REG[Rejestracja]
    L -->|Zaloguj| LOG[Logowanie]
    P[Strona publiczna /user/nick] -->|Napisz e-mail| MAIL[(mailto:)]
    P -->|Zadzwoń| TEL[(tel:)]
    P -->|Link| EXT[(serwis zewnętrzny)]
    P -->|Zgłoś nadużycie| ABUSE[(mailto: operator)]
    P -->|Utworzono w Profilo| L
    X[Nieznany / ukryty nick] --> E404[404]
    L --> LEGAL[Regulamin / Prywatność]
```

## Owner — first publication (main flow, target ≈ 5 min)

```mermaid
flowchart TD
    REG[Rejestracja<br/>e-mail, hasło, nazwa] --> W1
    REG -. e-mail .-> CONF[Link potwierdzający]
    W1[Kreator 1/4<br/>nazwa + nick] --> W2[Kreator 2/4<br/>układ + kolor]
    W2 --> W3[Kreator 3/4<br/>zdjęcie, opis, kontakt, linki]
    W3 --> W4[Kreator 4/4<br/>podgląd telefon / komputer]
    W4 -->|Opublikuj| CHK{E-mail potwierdzony?}
    CHK -->|nie| BAN[Baner: potwierdź e-mail<br/>Wyślij ponownie]
    CONF --> CHK
    BAN --> CHK
    CHK -->|tak| DONE[Opublikowano<br/>adres, Kopiuj link, QR]
    DONE --> ED[Edytor]
```

## Owner — returning

```mermaid
flowchart TD
    LOG[Logowanie] --> ED[Edytor<br/>treść + podgląd na żywo]
    LOG -->|Nie pamiętam hasła| RST[Reset hasła] --> NEWP[Nowe hasło] --> LOG
    ED -->|autozapis| ED
    ED -->|Podgląd| PRE[Podgląd pełnoekranowy]
    ED -->|Opublikuj zmiany| ED
    ED -->|Ukryj stronę| ED
    ED --> SHARE[Udostępnij<br/>adres, QR]
    ED --> ACC[Ustawienia konta<br/>hasło, usunięcie konta]
    ACC -->|Usuń konto + hasło| BYE[Konto usunięte] --> L[Landing]
    ED -->|Wyloguj| L
```

## Screens

| # | Screen | Role | Key | Stories |
|---|---|---|---|---|
| 1 | Strona publiczna — Klasyczny / Dzielony / Wizytówka | Visitor | ✔ | PUB-US-1…4 |
| 2 | Landing | Visitor | ✔ | — |
| 3 | Rejestracja | Visitor | ✔ | ACC-US-1 |
| 4 | Kreator 1/4: nazwa i nick (z wariantami przy zajętym) | Owner | ✔ | PRF-US-1, 2 |
| 5 | Kreator 2/4: układ i kolor | Owner | ✔ | PUB-US-1, 2 |
| 6 | Edytor / Kreator 3/4: treść, zdjęcia, kontakt, linki + podgląd | Owner | ✔ | PRF-US-3…8 |
| 7 | Opublikowano: adres, Kopiuj link, QR | Owner | ✔ | PRF-US-9, PUB-US-6 |
| 8 | Logowanie | Visitor | | ACC-US-3 |
| 9 | Reset hasła (prośba, nowe hasło) | Visitor | | ACC-US-4 |
| 10 | Potwierdzenie e-maila (sukces, link wygasł) | Owner | | ACC-US-2, 7 |
| 11 | Ustawienia konta (hasło, usunięcie) | Owner | | ACC-US-5, 6 |
| 12 | 404, Regulamin, Polityka prywatności | Visitor | | PUB-BR-6, 11 |

Key screens (1–7) get sketch and final mockups. Screens 8–12 are built from design-system components following the key screens.
