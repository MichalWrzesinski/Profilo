---
id: TASK-021
title: Production deployment, rollback, backups and monitoring
status: READY
priority: highest
iteration: ITER-05
depends_on: [TASK-003]
areas: [infra, api, client]
materials:
  - docs/standards/development/deployment.md
  - docs/decisions/0004-hosting-single-vps-docker-compose.md
  - AGENTS.md
---

## Goal
Production can be deployed by the user with automatic backup, verification and rollback, and failures are monitored.

## Scope
- Workflow `deploy-production.yml` (manual, environment `production`): DB backup, migrations, zero-downtime switch with readiness check, smoke tests, automatic rollback, GitHub release tag.
- Workflow `rollback-production.yml` accepting only previously deployed images.
- Daily encrypted backups of PostgreSQL and media to Storage Box (30 days), monthly automated restore test with report.
- Sentry for api and client (EU region, no PII, releases from CI, source maps uploaded), Better Stack uptime checks for `/ready`, alerts by e-mail.

## Out of scope
- High availability across several servers.

## Scenarios

### Scenario 1: Deploy
- When the user starts and approves the production workflow, then the backup is made, migrations run and the new version serves traffic after a passing readiness check.

### Scenario 2: Automatic rollback (negative)
- When the smoke tests fail after deployment, then the previous image is restored automatically and the workflow fails.

### Scenario 3: Backup restore
- When the monthly restore test runs, then the latest backup restores into a temporary database and the result is reported.

## Technical notes
Needs from the user: production server, domain and DNS, Storage Box, Brevo, Sentry and Better Stack accounts, GitHub production secrets. Mode without an agent account: only the user starts production deployments.

## Report
Filled in by development after the task.
