---
id: TASK-008
title: Editor: details and contact with autosave
status: READY
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
- `PATCH /me/profile` with optimistic locking (`version`, 409 with current state), field limits from profile.md, phone normalisation to E.164 (phonenumbers).
- Editor layout (form + preview placeholder) and mobile tabs; autosave 1 s after the last change; save states Zapisano / Zapisywanie… / Nie zapisano with retry; unsaved changes kept in the browser while offline.
- Badge "Masz nieopublikowane zmiany"; public page shows the new fields after publishing.

## Out of scope
- Links (TASK-009).
- Images (TASK-010).
- Live preview (TASK-011).

## Scenarios

### Scenario 1: Autosave
- When the owner stops typing for 1 second, then the draft is saved and the state shows "Zapisano".
- When the owner publishes, then the public page shows the filled fields and hides empty ones without gaps.

### Scenario 2: Conflict
- When the draft was changed in another window, then the editor shows "Szkic zmienił się w innym oknie — odśwież" and does not overwrite the newer data.

### Scenario 3: Invalid data (negative)
- When the bio exceeds 500 characters or the phone number is invalid, then the field shows the error and the draft keeps the last valid value.

### Scenario 4: Offline (negative)
- When the network fails during autosave, then the error banner is shown, publishing is disabled and the save is retried when the user clicks "Spróbuj ponownie".

## Report
Filled in by development after the task.
