---
id: TASK-009
title: Links: add, edit, remove and reorder
status: IN_PROGRESS
priority: high
iteration: ITER-02
depends_on: [TASK-008]
areas: [api, client]
materials:
  - docs/product/areas/profile.md
  - docs/api/openapi.yaml
  - docs/design/mockups/final/screens.html#editor
  - docs/design/mockups/final/screens.html#editor-empty
  - docs/design/design-system.html#profile
---

## Goal
The owner manages up to 20 labelled links in a chosen order, shown as link cards on the public page.

## Scope
- Link endpoints (add, update, delete, reorder), URL validation and normalisation (http/https only), service detection for known domains (PRF-BR-11).
- Editor section with empty state, inline add/edit form, drag-and-drop with keyboard support and ↑/↓ buttons on mobile.
- Public page link cards with service icon tiles, `rel="nofollow ugc noopener noreferrer"`, new tab.

## Out of scope
- Icon-only links of the Card layout (TASK-012).

## Scenarios

### Scenario 1: Add and reorder
- When the owner adds "linkedin.com/in/anna-wisniewska" without a label, then the link is saved as https with label "LinkedIn" and the LinkedIn icon.
- When the owner drags a link to the top, then the new order is saved and used on the public page after publishing.

### Scenario 2: Edit and remove
- When the owner edits a label or removes a link, then the change is saved in the draft.

### Scenario 3: Invalid link (negative)
- When the URL contains spaces or uses `javascript:`, then 422 `invalid_url` and the field message are shown.
- When the owner tries to add a 21st link, then 409 `links_limit_reached` is shown.

## Report
Filled in by development after the task.
