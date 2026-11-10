---
id: TASK-008
title: Editor: details and contact with autosave
status: DONE
priority: high
iteration: ITER-02
depends_on: [TASK-007]
areas: [api, client]
materials:
  - docs/product/areas/profile.md
  - docs/api/openapi.yaml
  - docs/design/mockups/final/screens.html#editor
  - docs/design/mockups/final/screens.html#editor-empty
  - docs/design/mockups/final/screens.html#editor-error
  - docs/design/mockups/final/screens.html#editor-loading
---

## Goal
The owner edits display name, headline, bio, position, company, city, public e-mail and phone, and every change is saved automatically to the draft.

## Scope
- `PATCH /me/profile` with optimistic locking (backend already done in TASK-006 — extend tests and wire the editor) (`version`, 409 with current state), field limits from profile.md, phone normalisation to E.164 (phonenumbers).
- Editor layout (form + preview placeholder) and mobile tabs; autosave 1 s after the last change; save states Zapisano / Zapisywanie… / Nie zapisano with retry; unsaved changes kept in the browser while offline.
- Badge "Masz nieopublikowane zmiany"; public page shows the new fields after publishing.
- Contact on the public page: „Zadzwoń” → `tel:` with E.164, phone shown grouped (e.g. +48 601 234 567), default country +48; public e-mail field never pre-filled with the login e-mail (PRF-BR-10).

## Out of scope
- Links (TASK-009).
- Images (TASK-010).
- Live preview (TASK-011).

## Scenarios

### Scenario 1: Autosave
- When the owner stops typing for 1 second, then the draft is saved and the state shows "Zapisano".
- When the owner publishes, then the public page shows the filled fields and hides empty ones without gaps.

### Scenario 2: Contact buttons
- When the owner enters „601234567” and publishes, then the page shows „+48 601 234 567” and „Zadzwoń” links to `tel:+48601234567`.
- When a new owner opens the contact section, then the public e-mail field is empty.

### Scenario 3: Conflict
- When the draft was changed in another window, then the editor shows "Szkic zmienił się w innym oknie — odśwież" and does not overwrite the newer data.

### Scenario 4: Invalid data (negative)
- When the bio exceeds 500 characters or the phone number is invalid, then the field shows the error and the draft keeps the last valid value.

### Scenario 5: Offline (negative)
- When the network fails during autosave, then the error banner is shown, publishing is disabled and the save is retried when the user clicks "Spróbuj ponownie".

## Report

**Done.** Approved after 2 review rounds. Editor at `/edytor` (link „Edytuj stronę” in the panel): sections „O mnie” (name, headline, bio with counter, position, company, city) and „Kontakt” (public e-mail, phone with country prefix, default +48), top bar with save state, badge, „Panel” and „Opublikuj” / „Opublikuj zmiany”; preview column with a placeholder (live preview is TASK-011) and „Edycja” / „Podgląd” tabs on phones. Autosave 1 s after the last edit sends only changed fields with the draft version; a field with an error (checked in the browser and by the API) is held back so the draft keeps its last valid value, the other fields are still saved; a conflict stops saving and offers „Odśwież”; a failed save shows the banner, disables publishing and keeps the changes in this browser (`localStorage`) until „Spróbuj ponownie” succeeds; changes kept from a failed save are restored after reload if the draft version is unchanged. Public page now shows position, company, city, „Zadzwoń” (`tel:` with E.164), the grouped number and the bio; empty fields leave nothing behind. The `PATCH /me/profile` backend was done in TASK-006; this task adds API tests for the editor rules.

Acceptance criteria (verified in the browser and by tests):
- S1 autosave — met: typing the bio saved it (state „Zapisano”, only `bio` and `version` sent); after „Opublikuj zmiany” the public page showed position, city, phone and bio, and no gaps for empty fields (test).
- S2 contact — met: „601234567” was stored as `+48601234567`; the page shows „+48 601 234 567” and „Zadzwoń” links to `tel:+48601234567`; a new owner's public e-mail field is empty (API and client tests).
- S3 conflict — met: after a change from another session the editor showed „Szkic zmienił się w innym oknie — odśwież.”, did not overwrite it, and „Odśwież” loaded the newer draft („Gdańsk”).
- S4 invalid data — met: a bio of 501 characters and an invalid phone show the error under the field; the draft keeps the last valid value (API test) while other fields keep saving.
- S5 offline — met: with the API stopped, typing showed „Nie zapisano”, the banner and a disabled publish button; after starting the API „Spróbuj ponownie” saved the change.

Checks: api 182 tests, 99 %; client 203 tests, 95.6 % branches; contract 16 paths.

Review round 1 fixes:
- Leaving the editor right after typing no longer loses the change: „Panel” saves first (and asks before leaving when a field cannot be saved); closing the editor during the delay sends the change with `keepalive` — verified in the browser (typed, clicked „Panel” within a second, the value was saved).
- An API error for a field edited again while the request was in flight is ignored and the new value is sent; a 422 that cannot be attached to a field stops with the error banner instead of repeating the request.
- The publish response no longer brings back an older draft version when an autosave finished meanwhile (only the status is taken), so no false conflict.
- „Zapisywanie…” is shown during the 1 s delay; kept drafts are removed from the browser at logout (`lib/draftStorage.ts`); lengths are counted in characters as the API does (an emoji is one); the counter uses the trimmed value; „48601234567” typed with +48 chosen is saved as `+48601234567`.
- Loading state with the top bar and skeletons as in the mockup; error hints in live regions, `aria-invalid` on the country select, tabs linked to their panels; tests for the debounce restart, leaving, closing, the in-flight 422 and the publish race.
- The lockfile also aligns the `lucide-react` range with package.json (`^1.61.0`), left from TASK-006.

Round 2 (minor, fixed before merge): the public e-mail error is announced (its live region stays in place); leaving offline tries once and then asks; the leave question says the changes stay in this browser; Cmd/Ctrl/Shift/middle click on „Panel” is left to the browser; a 422 naming only fields that were not sent stops with the error banner.

Decisions: the phone prefix list has 9 countries (PL first); the grouped number is shown under the contact buttons so it is readable without tapping; the editor has its own route `/edytor` with its own top bar (as in the mockup), the panel keeps the status and „Ukryj stronę”; „Opublikuj zmiany” is disabled while anything is unsaved or invalid. New dependency: `libphonenumber-js` 1.13.15.
