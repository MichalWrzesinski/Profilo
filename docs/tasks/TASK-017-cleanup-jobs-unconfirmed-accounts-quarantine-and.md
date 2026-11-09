---
id: TASK-017
title: Cleanup jobs: unconfirmed accounts, quarantine and orphaned images
status: READY
priority: medium
iteration: ITER-04
depends_on: [TASK-016]
areas: [api]
materials:
  - docs/product/areas/accounts.md
  - docs/architecture.md
---

## Goal
The system deletes unconfirmed accounts after 7 days, releases quarantined nicks after 30 days and removes unused image files.

## Scope
- Celery Beat schedules (hourly), idempotent tasks with a lock, structured logs with counts.

## Out of scope
- Reminder e-mails before deletion (not planned).

## Scenarios

### Scenario 1: Unconfirmed account
- When an account stays unconfirmed for 7 days, then it is deleted with its draft and its nick becomes available.

### Scenario 2: Quarantine
- When 30 days pass after account deletion, then the nick can be taken again.

### Scenario 3: Confirmed account (negative)
- When a confirmed account is older than 7 days, then the job does not touch it.
- When the job runs twice at the same time, then only one instance processes records.

## Report
Filled in by development after the task.
