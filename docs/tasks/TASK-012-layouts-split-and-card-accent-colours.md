---
id: TASK-012
title: Layouts Split and Card, accent colours and wizard step 2
status: IN_PROGRESS
priority: high
iteration: ITER-03
depends_on: [TASK-011]
areas: [api, client]
materials:
  - docs/product/areas/public-page.md
  - docs/design/style.md
  - docs/design/tokens.css
  - docs/design/mockups/final/screens.html#public-split
  - docs/design/mockups/final/screens.html#public-card
  - docs/design/mockups/final/screens.html#wizard-layout
---

## Goal
The owner chooses Classic, Split or Card and one of 8 accent colours, and the public page renders accordingly on phones and desktops.

## Scope
- Renderers for the Split and Card layouts per mockups (Card: icon links, list below the card when more than 6 links); layout and accent fields already exist since TASK-004, snapshot schema unchanged.
- Wizard step 2 with layout options and swatches; "Wygląd" section in the editor.
- Default hero graphic in the accent colour when no background image is set.

## Out of scope
- Custom colours (Later).

## Scenarios

### Scenario 1: Choose layout
- When the owner selects Card and Bordo and publishes, then the public page shows the card on the background in the Bordo accent.

### Scenario 2: Responsive
- When any layout is opened at 320 px and 1440 px widths, then there is no horizontal scroll and all text meets WCAG AA contrast (automated axe check).

### Scenario 3: Text over images
- When a very light background image is used in Card or Classic, then text over the image keeps contrast ≥ 4.5:1 thanks to the overlay (pixel sampling in a visual test).

### Scenario 4: Invalid value (negative)
- When the API receives an accent outside the palette, then 422 is returned and the draft is unchanged.

## Report

**Implemented, waiting for review.** `PublicPage` (was `ClassicPage`) renders the three layouts from shared parts in the fixed order: Classic (banner), Split (image side, content side; image on top on phones), Card (card on the image or the default graphic; up to 6 links as service icons in the card, more as a list in a second card below). Without a background image every layout uses the default graphic in the accent colour (Classic now always has a banner). Text always sits on the page or a card surface, never on the image. Wizard step 2 „Wygląd” (`/kreator/wyglad`) with the layout tiles (mockup miniatures) and the 8 swatches, both radio groups with arrow keys and one tab stop; saved through the editor's autosave, so leaving saves first. The editor has a collapsible „Wygląd” section with the same pickers and a summary („Wizytówka · Bordo”); the live preview follows at once. API: `layout`/`accent` cannot be cleared (`null` → 422, before it was a 500).

Acceptance criteria (verified in the browser, by E2E and unit tests):
- S1 choose layout — met: in the browser Wizytówka + Bordo in step 2, published from step 4 → the public page shows the card on the background image with Bordo buttons and icon links.
- S2 responsive — met: the E2E test publishes every layout with each of the 8 accents and runs axe (WCAG 2.0/2.1 A and AA) at 1440 px, and every layout at 320 px — no violations, no horizontal scroll. It found and fixed a real overflow: long link addresses widened the link list beyond a 320 px screen (`grid-template-columns: minmax(0, 1fr)` in the design system).
- S3 text over images — met: with a very light background image (fixture) in Card and Classic at 320 and 1440 px, the E2E test hides each text element and its icons, screenshots what is behind it and checks contrast ≥ 4.5:1 against every sampled pixel.
- S4 invalid value — met: an accent outside the palette, a hex colour, an unknown layout or `null` → 422 and the draft unchanged (API test).

Checks: api 296 tests, 99 %; client 334 tests, 95.7 % branches; contract 21 paths; E2E 3 tests pass locally.

Decisions: Classic shows the default graphic banner when no background is set (the TASK-007 page without a banner is gone); Card with more than 6 links puts the list in a second card (so no text sits on the image); the Card icon links use the same short service marks as the link tiles; text never sits on images, so no overlay is needed. New E2E dependencies: @axe-core/playwright 4.14.0, pngjs 7.0.0.
