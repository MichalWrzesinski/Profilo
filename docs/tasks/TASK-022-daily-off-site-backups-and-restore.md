---
id: TASK-022
title: Daily off-site backups and restore test
status: IN_PROGRESS
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
- `backup` service in the production Compose (runs on the server, not in GitHub Actions): daily encrypted PostgreSQL dumps and media archive to the Storage Box in another location, retention 30 days.
- Monthly restore test on the server into a temporary database with a report (log + alert e-mail on failure); alert e-mail when a daily backup fails.
- Storage Box credentials and encryption key delivered to the server by `deploy-production` from `PROD_*` repository secrets (AGENTS.md).

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
Needs from the user: Storage Box; its credentials and the backup encryption key as `PROD_*` repository secrets, used only by the deploy workflow.

## Report

**Implemented, waiting for the production server and the Storage Box.** Delivered:
- `infra/backup/` — image `profilo-backup` (PostgreSQL 18.6 client from the same base as the database, restic 0.18.1, curl), published by CI with api and client; `profilo-backup`:
  - `schedule` (default): daily backup at 02:30 UTC, monthly restore test on the 1st at 04:30 UTC; due jobs run also after a restart, at most once a day / month; marks are written when a job finished, so a job interrupted by a deployment runs again;
  - `backup`: `pg_dump` (restic `--stdin-from-command`: no snapshot when the dump fails) and the `media` volume as encrypted snapshots over SFTP with a pinned host key; then `forget --group-by host,tags --keep-within 30d --prune`;
  - `restore-test`: latest database snapshot into `restore_test_<time>`, row counts restored / live per table, Alembic revision, media file count, `restic check --read-data-subset=5%`; the temporary database is dropped (also leftovers of an interrupted test); the report is e-mailed;
  - every failure e-mails the job's log to `ALERT_EMAIL` through the application's SMTP account (password in a netrc file, not on the command line); results in the `backup_state` volume for TASK-023;
  - `dump-db` and `restic <args>` for restores (runbook).
- `compose.yml`: service `backup` (profile; only the database login, SMTP and its own settings; media read-only; keys read-only); `deploy.sh` starts, pulls and cleans it up with the background services only when `backup/config` exists, and removes it otherwise.
- `deploy-remote.sh` writes `backup/config` and `backup/keys/` (mode 600) from `PROD_BACKUP_*`; `deploy-production` and `rollback-production` require them (`BACKUP_REQUIRED`); staging has none.
- Runbook *Backups*: Storage Box setup, settings, manual jobs, database and media restore (with consent); `PROD_*` table extended.

Verified:
- Image alone against a test SFTP server, PostgreSQL and Mailpit: first backup creates the repository; restore test 42/42 rows, report e-mail; SFTP unreachable → job fails, alert e-mail (scenario 3); database down → job fails, **no snapshot written** (the first version piped `pg_dump` and would have kept a truncated one); a snapshot dated 40 days back is removed by retention, today's are kept (the first version grouped by path and kept it).
- Ubuntu 24.04 VM bootstrapped as production, settings written with the workflow's commands, real `deploy.sh`: the first deployment starts `backup`, which runs the day's backup at once (scenario 1: repository created, `db` and `media` snapshots); restore test with every table matching (e.g. `reserved_nicks` 61/61), media 2/2, report e-mail (scenario 2); the next deployment recreates `backup` on the new release without repeating the day's backup; SFTP stopped → alert e-mail (scenario 3); without `backup/config` the service is removed; the runbook restore commands bring back deleted rows (53 → 61) and a deleted image.
- shellcheck, actionlint.

Not verified: a real Storage Box and the deploy workflows writing the settings (no production server yet; the same commands ran by hand on the VM); the schedule over real days (the due-time logic was exercised by starting after 02:30).

Notes:
- Retention is relative to the newest snapshot (restic): while daily backups succeed, deleted data leaves the backups after at most 30 days as the privacy policy says; if backups stop, nothing is removed until they run again (an alert is sent every day meanwhile).
- The privacy policy names Hetzner for backups; another SFTP provider must be added there. Its placeholder „potwierdzenie po wdrożeniu kopii zapasowych” stays until production runs.

Needs from the user: Storage Box in another location than the production server, `PROD_BACKUP_REPOSITORY`, `PROD_BACKUP_SSH_KEY`, `PROD_BACKUP_KNOWN_HOSTS`, `PROD_BACKUP_PASSWORD` (also kept in a password manager), `PROD_ALERT_EMAIL` (runbook *Backups*).

Decisions:
- restic over SFTP instead of hand-made `pg_dump | gpg` files: encryption, deduplication (daily media snapshots cost only the changes), retention and `check` built in; works with a Storage Box and any SFTP server.
- The service runs in its own image on the server (task scope), not in GitHub Actions or in the api image: the database client must match PostgreSQL 18, and the backup needs no application code.
- Alerts by e-mail through the application's SMTP account (no new provider); monitoring of the results comes with TASK-023.
