---
id: TASK-011
title: Live preview and wizard step 3–4
status: READY
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
Filled in by development after the task.
