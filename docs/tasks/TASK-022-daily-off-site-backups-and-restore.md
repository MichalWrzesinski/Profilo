---
id: TASK-022
title: Daily off-site backups and restore test
status: READY
priority: high
iteration: ITER-05
depends_on: [TASK-021]
areas: [infra]
materials:
  - docs/standards/development/deployment.md
  - docs/decisions/0004-hosting-single-vps-docker-compose.md
  - docs/architecture.md#personal-and-sensitive-data
---

## Goal
Production database and media are backed up daily, encrypted and off-site, and restoring is tested automatically every month.

## Scope
- Backup container or scheduled job: encrypted PostgreSQL dumps and media archive to the Storage Box in another location, retention 30 days.
- Monthly restore test into a temporary database with a report (log + alert on failure); alert when a daily backup fails.

## Out of scope
- Point-in-time recovery.

## Scenarios

### Scenario 1: Daily backup
- When a day passes, then a new encrypted backup of the database and media exists off-site and backups older than 30 days are removed.

### Scenario 2: Restore test
- When the monthly restore test runs, then the latest backup restores into a temporary database and row counts are reported.

### Scenario 3: Failure (negative)
- When the Storage Box is unreachable, then the backup job fails and an alert e-mail is sent.

## Technical notes
Needs from the user: Storage Box and its credentials as repository secrets.

## Report
Filled in by development after the task.
