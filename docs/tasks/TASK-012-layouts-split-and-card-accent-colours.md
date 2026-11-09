---
id: TASK-012
title: Layouts Split and Card, accent colours and wizard step 2
status: READY
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
Filled in by development after the task.
