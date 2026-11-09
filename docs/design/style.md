# Style

## Style brief (from the user, 2026-11-09)

| Item | Decision |
|---|---|
| References | about.me (e.g. about.me/michael) — but visually richer; Profilo competes with about.me |
| Mode | Light only, but not white: off-white / tinted backgrounds |
| Colours | Professional blues: sky blue, blue, navy + one accent colour |
| Density | Minimal, plenty of white space |
| Logo | None existing — create wordmark + icon |
| Brand words | professional, calm, modern, trustworthy |

## Style direction

**Chosen: Variant A — "Granat korporacyjny"** (user decision, 2026-11-09). Reference mockup: `mockups/style-variants/profile.html#a`, screenshots `variant-a-*.png`. Variants B and C are kept in `mockups/style-variants/` for reference only.

| Element | Decision |
|---|---|
| Typeface | Plus Jakarta Sans (Google Fonts, OFL) for headings and text; weights 400, 500, 600, 700, 800 |
| Character | Geometric and solid: navy as the main colour, a regular grid, cards with soft borders, moderate radii (10–12 px, 24 px for the avatar) |
| Graphics | Navy-blue gradient with a fine grid, circles and one accent dot; used as the default background when the owner uploads no image |
| Buttons | Primary filled navy, secondary outlined; min. height 48 px |
| Links on the public page | Cards with an icon tile, label and domain |

### Brand palette (Profilo service)

| Token | Hex | Use |
|---|---|---|
| navy-900 | #0F2747 | Headings, primary buttons, logo |
| blue-700 | #1F4E8C | Gradients, icons |
| blue-100 | #E3EAF5 | Icon tiles, subtle fills |
| bg | #EEF2F7 | Page background (light, not white) |
| surface | #F8FAFC | Cards, inputs |
| accent | #E0592A | Brand accent: logo dot, focus ring, decorative highlights only — never as text on light backgrounds |

### Owner accent palette (PUB-BR-3)

Eight colours an owner can choose for their page. Each has ≥ 5:1 contrast with white text and ≥ 4.5:1 against the page background.

| Name (PL) | Hex | vs white | vs #EEF2F7 |
|---|---|---|---|
| Granat (default) | #0F2747 | 15.0 | 13.3 |
| Niebieski | #1F4E8C | 8.3 | 7.4 |
| Błękit | #1D63C4 | 5.8 | 5.1 |
| Morski | #0F6B6B | 6.3 | 5.6 |
| Zieleń | #2D6A3E | 6.5 | 5.8 |
| Bordo | #8E2442 | 8.5 | 7.5 |
| Miedź | #B3461C | 5.5 | 4.9 |
| Fiolet | #5B3FA6 | 7.8 | 6.9 |

All text/background pairs of the chosen variant meet WCAG AA (body text ≥ 4.5:1).

## Tone of voice

Informal "ty", short, no jargon, always the next step.

- Error: „Ten adres jest już zajęty. Może anna-wisniewska-2 albo anna-wisniewska-krakow?”
- Confirmation: „Gotowe! Twoja strona jest już online: profilo.pl/user/anna-wisniewska”
- Empty state: „Nie masz jeszcze linków. Dodaj LinkedIn, portfolio albo stronę firmy, żeby łatwiej było Cię znaleźć.”

## Logo and identity

Files in `brand/`: `logo.svg` (icon + wordmark), `icon.svg` / `favicon.svg` (rounded icon), `icon-square.svg` (full-bleed source for app icons), `favicon.ico` (32 px), `apple-touch-icon.png` (180 px), `icon-192.png`, `icon-512.png` (PWA / Open Graph fallback).

The wordmark in `logo.svg` uses live text in Plus Jakarta Sans 800; iteration 0 converts it to outlines once the font file is in the repository.

## Mockups

| Stage | Location | Status |
|---|---|---|
| Style direction | `mockups/style-variants/` | Accepted: variant A |
| Sketch mockups (greyscale) | `mockups/sketches/index.html`, PNG in `mockups/sketches/png/` | Accepted (2026-11-09) |
| Final mockups with states | `mockups/final/index.html` (`screens.html#<view>`), PNG in `mockups/final/png/` | Awaiting acceptance |

## Design system

- `tokens.css` — all design tokens (colours, owner accent palette, typography, spacing, radii, borders, shadows, motion, layout). Imported directly by the frontend.
- `components.css` — reference styles of every component used in the mockups; documentation for building React components, not a public API.
- `design-system.html` — tokens and components with variants and states (screenshot: `design-system.png`).

Key interaction decisions fixed in the final mockups:

- Wizard: 4 steps (name and address → look → content → preview), "Dokończę później" exits to the editor; the confirm-e-mail banner is visible from step 1; publishing is disabled until the e-mail is confirmed.
- Editor: form on the left, live draft preview on the right (desktop) / "Edycja | Podgląd" tabs (phone); autosave status in the top bar; badge "Masz nieopublikowane zmiany".
- Card layout shows links as icon tiles with accessible labels.
- Icons: line icons 24 px, stroke 1.8 — implement with Lucide; service marks via Simple Icons or letter tiles.
