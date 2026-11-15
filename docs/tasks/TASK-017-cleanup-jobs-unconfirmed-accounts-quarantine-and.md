---
id: TASK-017
title: Cleanup jobs: unconfirmed accounts, quarantine and orphaned images
status: IN_PROGRESS
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

**Implemented, in review.** Three Celery Beat jobs, hourly at minutes 5, 15 and 25, each in its module:
- `accounts.delete_unconfirmed` deletes accounts unconfirmed for more than 7 days (ACC-BR-6) in batches of 100 (`FOR UPDATE SKIP LOCKED`, at most 5 000 per run), together with the draft by cascade; the nick is released at once (no quarantine), then the image files and cached preview cards are removed.
- `profiles.release_quarantined_nicks` removes quarantines past their 30 days (ACC-BR-10). Nick checks already ignored expired rows, so this keeps the table small.
- `media.remove_orphaned_files` removes stored images no row points at and empty account folders, both only when older than 1 hour (an upload writes the files before its row is committed).

`app.core.jobs.run` gives every job a Valkey lock (`job:{name}`, 50 min, skipped when held or when Valkey is down) and a `job_done` log line with counts, and disposes the engine and the Valkey client after each run (each Celery run has its own event loop).

Acceptance criteria:
- S1 unconfirmed account — met: API test with an 8-day-old unconfirmed account (deleted with profile and files, nick free for someone else at once), a 6-day-old one and a confirmed 30-day-old one (both kept). Live: an account backdated 8 days, the task called on the worker → `unconfirmed_account_deleted`, `job_done deleted=1`, its old token gets 401.
- S2 quarantine — met: API test (a quarantined nick refused, after expiry free and the row removed; system/offensive words untouched). Live: `job_done released=1`.
- S3 confirmed account / two runs at once — met: the confirmed old account is untouched (above); a second run while the first holds the lock is skipped and the job body runs once (test); an account row locked elsewhere is skipped by `SKIP LOCKED` and deleted on the next run (test); running a job twice changes nothing.

Orphaned files live: an orphan backdated 3 hours removed, a 3-hour-old empty folder removed, a fresh empty folder kept.

Checks: api 389 tests, 99 %; client unchanged; contract unchanged.

Decisions: the job lock fails closed (skip, retry next hour) — deletions should not run twice by accident, and `SKIP LOCKED` keeps even that safe; folders and files whose time is unknown are treated as new and kept; the account cleanup removes files directly in the worker (no extra task).

Review round 1 fixes: a safety valve — the orphan cleanup stops with `orphan_cleanup_aborted` when the image table is empty or more than 20 % of the stored images (and more than 10) look orphaned, as during a database restore, and removes at most 500 per run; the runbook says to stop `beat` while restoring; empty folders are removed with a non-recursive `rmdir`, so an upload that has just put a file there wins; storage is scanned one account folder at a time (memory); Beat entries expire after 50 minutes (no backlog after an outage); `media_delete_failed` carries the account id; engine and Valkey disposal no longer hide each other's errors.
