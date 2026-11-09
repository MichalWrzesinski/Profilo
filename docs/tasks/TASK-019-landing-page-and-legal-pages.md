---
id: TASK-019
title: Landing page and legal pages
status: READY
priority: high
iteration: ITER-05
depends_on: [TASK-012]
areas: [client]
materials:
  - docs/design/mockups/final/screens.html#landing
  - docs/product/areas/public-page.md
  - docs/product/overview.md#constraints
---

## Goal
Visitors understand the product on the landing page, can start registration with a chosen address, and read the terms and privacy policy.

## Scope
- Landing per mockup with the "Zarezerwuj adres" field passing the nick to registration; example page in a phone frame.
- Pages `/regulamin` and `/prywatnosc` with drafts covering GDPR (data, purposes, retention incl. 30-day backups, processors: Hetzner, Brevo, Sentry), DSA notice-and-action, and operator placeholders.

## Out of scope
- Final legal wording and operator data — provided by the user before production.

## Scenarios

### Scenario 1: Start from landing
- When a visitor types "anna" and clicks "Zarezerwuj adres", then registration opens and wizard step 1 proposes "anna" if available.

### Scenario 2: Legal pages
- When the footer links are opened, then both pages render with the current operator placeholders clearly marked.

### Scenario 3: Taken address (negative)
- When the typed address is taken, then wizard step 1 shows it as taken with suggestions.

## Technical notes
Legal texts are drafts by the agent; the user reviews them before production (pre-deployment list).

## Report
Filled in by development after the task.
