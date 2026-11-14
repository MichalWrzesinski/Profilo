---
id: TASK-011
title: Live preview and wizard step 3–4
status: DONE
priority: high
iteration: ITER-02
depends_on: [TASK-009, TASK-010]
areas: [client]
materials:
  - docs/design/mockups/final/screens.html#editor
  - docs/design/mockups/final/screens.html#wizard-preview
  - docs/design/flows.md
  - docs/decisions/0001-single-nextjs-frontend.md
---

## Goal
The owner sees the draft rendered exactly like the public page, on desktop and phone sizes, and the wizard leads from content to preview and publication.

## Scope
- Shared public page component rendering the draft in the editor preview with Komputer/Telefon toggle.
- Wizard step 3 (content = editor with wizard bar) and step 4 (full preview, publish, "Popraw treść"); "Dokończę później" exits to the editor.
- E2E Playwright test of the main flow: register → confirm (Mailpit) → nick → content → publish → public page.

## Out of scope
- Layout choice (TASK-012).

## Scenarios

### Scenario 1: Preview matches
- When the owner edits a field, then the preview updates within 1 second and matches the public page after publishing (visual comparison in E2E).

### Scenario 2: Wizard flow
- When a new owner completes steps 1–4, then the page is published and the "Opublikowano" screen or editor is shown.

### Scenario 3: Not confirmed (negative)
- When the e-mail is not confirmed at step 4, then "Opublikuj stronę" is disabled with the hint "Najpierw potwierdź e-mail".

## Report

**Done.** Approved after 2 review rounds; CI `check` and `e2e` green. Preview: `/podglad` renders the same `ClassicPage` as `/user/{nick}`; the editor and wizard step 4 show it in an iframe of 1280 px (Komputer) or 390 px (Telefon), scaled to fit, so the phone layout really uses the phone breakpoints. The draft goes to the frame by `postMessage` (same origin and parent window only), including values typed but not saved yet; draft images are fetched with the access token and passed as blob URLs; links in the frame do not navigate. On servers `/podglad` may be framed by the same origin only (Caddy CSP). Wizard: step 1 „Dalej” → step 3 „Treść” (the editor with the wizard top bar and a bottom bar „← Wstecz” / „Dalej: podgląd →”, which save pending changes first) → step 4 „Podgląd” („← Popraw treść”, „Opublikuj stronę”, disabled with „Najpierw potwierdź e-mail” until the e-mail is confirmed) → the editor with „Strona jest opublikowana.” and the address. „Dokończę później” leads to the editor. Step 2 (layout and colour) comes with TASK-012; until then the stepper shows steps 1, 3 and 4. E2E: Playwright 1.64.1 in its own Compose service (`make e2e`) and a CI job `e2e` that uploads the report on failure.

Acceptance criteria (verified by the E2E test, in the browser and by unit tests):
- S1 preview matches — met: in the E2E test a typed headline appears in the preview within 1 second; after publishing, the public page's markup equals the preview's (inline-style spacing normalised); in the browser the phone preview shows the mobile layout.
- S2 wizard flow — met: the E2E test registers, takes the proposed nick, fills content and a link, confirms the e-mail through Mailpit, publishes in step 4 and lands in the editor with „Strona jest opublikowana.”; the public page shows the content.
- S3 not confirmed — met: before confirming, step 4 shows „Opublikuj stronę” disabled with „Najpierw potwierdź e-mail” (E2E and unit tests).

Checks: api 292 tests, 99 %; client 319 tests, 95.5 % branches; contract 21 paths; E2E main flow passes locally.

Review round 1 fixes:
- „Dokończę później” and the logo in step 3 now save pending changes first (the step registers its exit with the wizard layout), like the editor's „Panel”; before, an edit typed less than a second earlier could end in a false conflict in the editor.
- The sticky preview in step 3 ends above the bottom bar.
- Draft images for the preview are fetched once per URL even while several updates wait; blobs of replaced images are revoked at once, the rest on leaving.
- Step 4 sends the draft to the frame only when it changes.
- E2E: the test waits for `<html data-hydrated>` before using a page (a client marker), the E2E code is checked by Prettier and `tsc` before the run, CI makes the checkout writable for the dev containers (uid 1000) and prints container logs on failure (the first CI run failed: the dev server could not write into the checkout).

Decisions: in step 4 the hint „Najpierw potwierdź e-mail” stays visible on phones too (the mockup hides it there; without it a disabled button has no visible reason). Commit 53678d6 mixes CI, Compose and client files under `[client]`; it is left as is (rewriting pushed history), later commits are split by area. The preview is an iframe (not the component inline) so media queries match the chosen device; the E2E comparison is of the rendered markup rather than pixels (same component, and it does not depend on fonts or the dev overlay); before the first publication the preview uses the address the page will have (window origin + nick); the E2E job is not a required check yet (runs the dev server; can be made required once stable).
