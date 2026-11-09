---
id: TASK-014
title: Published screen, sharing menu and QR code
status: READY
priority: medium
iteration: ITER-03
depends_on: [TASK-012]
areas: [api, client]
materials:
  - docs/product/areas/public-page.md
  - docs/api/openapi.yaml
  - docs/design/mockups/final/screens.html#published
  - docs/design/design-system.html#nav
---

## Goal
After publishing the owner gets the address with "Kopiuj link" and a QR code to download as PNG or SVG, also later from the menu.

## Scope
- `qr` module and `GET /me/profile/qr?format=svg|png` (segno), canonical URL from settings.
- "Opublikowano" screen after first publication with „Kopiuj link” and „Otwórz stronę”; menu "Udostępnij: adres i kod QR" in the editor; toast "Skopiowano link".
- QR: PNG 1024×1024 px and SVG, dark modules on a light background, 4-module quiet zone (PUB-BR-12).

## Out of scope
- Printable business card templates (not planned).

## Scenarios

### Scenario 1: Share
- When the owner publishes for the first time, then the screen shows the address, copy action and QR preview.
- When the QR code is scanned, then it opens the canonical page URL.
- When the PNG is downloaded, then it is 1024×1024 px with a quiet zone.

### Scenario 2: Never published (negative)
- When the QR endpoint is called before the first publication, then 409 `not_published` is returned.

## Report
Filled in by development after the task.
