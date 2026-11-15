---
id: TASK-014
title: Published screen, sharing menu and QR code
status: DONE
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

**Done.** Approved after 2 review rounds. New `qr` module (segno 1.6.6, pure Python) and `GET /me/profile/qr?format=svg|png` as the contract already described it: the canonical page URL from settings, navy modules on white, a 4-module quiet zone, error level M; PNG exactly 1024 × 1024 (module edges rounded to whole pixels instead of resampling), SVG with a viewBox for print; downloaded as `profilo-{nick}.{format}`. The first publication (from the wizard or the editor) opens „Gotowe! Twoja strona jest online” (`/opublikowano`, as in the mockup): the address with „Kopiuj link” (toast „Skopiowano link”), „Otwórz stronę”, the QR preview and „Pobierz PNG” / „Pobierz SVG”. Later the editor's „Udostępnij” button (name „Udostępnij: adres i kod QR”) opens the same panel in a dialog; it shows while the page is visible. The old success banner in the editor (`?opublikowano=1`) is gone.

Acceptance criteria:
- S1 share — met: E2E publishes from the wizard, lands on the screen, checks the address and the QR preview, downloads the PNG (`profilo-{nick}.png`, 1024 × 1024, light border on every side). In the browser both the PNG and the SVG were read with the browser's `BarcodeDetector` and decode to the canonical URL; API tests compare every module of the PNG with the symbol of the URL and check the quiet zone. Copy verified in the browser (the pane denies the Clipboard API, the fallback copied and showed the toast).
- S2 never published — met: 409 `not_published` (API test and curl before the first publication).

Checks: api 323 tests, 99 %; client 379 tests, 95.7 % branches; contract 24 paths; E2E 6 tests pass locally.

Decisions: the code stays available after unpublishing (the address does not change, PRF-BR-7), only „Udostępnij” in the editor is hidden while the page is not visible; SVG is the default format, as in the contract; copy falls back to `document.execCommand('copy')` and then to selecting the address with a Ctrl+C hint. The editor's top bar did not fit phones even before this task (~425 px of content at 375 px); with icons for Panel and Udostępnij and „Opublikuj” instead of „Opublikuj zmiany” it fits 320 px. The rest of the editor still overflows at 320 px (images section, the „Wygląd” header): a separate follow-up.

Review round 1 fixes: a blocked page gets no QR code (409 `page_blocked`); the download buttons use `aria-disabled` so the focus stays on them while a file downloads, and after „Spróbuj ponownie” the focus moves to the code box; the dialog's focus trap pulls the focus back when it fell out, and a re-render with a new `onClose` no longer moves the focus; a repeated copy announces „Skopiowano link” again.
