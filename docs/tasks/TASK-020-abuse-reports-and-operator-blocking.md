---
id: TASK-020
title: Abuse reports and operator blocking
status: READY
priority: medium
iteration: ITER-05
depends_on: [TASK-007]
areas: [api, client]
materials:
  - docs/product/areas/public-page.md
  - docs/architecture.md
---

## Goal
Anyone can report a page by e-mail, and the operator can block and unblock a page with a CLI command.

## Scope
- "Zgłoś nadużycie" mailto with the page URL in the subject (operator address from settings).
- CLI `profilo block-profile <nick>` / `unblock-profile <nick>` in the api image; blocked pages return 404; panel notice "Strona zablokowana — skontaktuj się z nami"; publish returns 403 `profile_blocked`.

## Out of scope
- Admin panel (out of scope of v1).

## Scenarios

### Scenario 1: Block
- When the operator blocks a nick, then the public page returns 404 immediately and the owner sees the notice.

### Scenario 2: Unblock
- When the operator unblocks it, then the last published version is visible again.

### Scenario 3: Blocked owner (negative)
- When the owner of a blocked page tries to publish, then 403 `profile_blocked` is returned.

## Report
Filled in by development after the task.
