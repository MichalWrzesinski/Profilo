---
id: TASK-021
title: Production deployment and rollback
status: READY
priority: highest
iteration: ITER-05
depends_on: [TASK-003]
areas: [infra]
materials:
  - docs/standards/development/deployment.md
  - docs/decisions/0004-hosting-single-vps-docker-compose.md
  - AGENTS.md
---

## Goal
The user deploys a tested image to production with one manual workflow that verifies the release and rolls back automatically on failure.

## Scope
- Workflow `deploy-production.yml`: `workflow_dispatch` on `main` only, guard `github.actor == MichalWrzesinski`, repository secrets `PROD_*` (no GitHub environments — AGENTS.md); steps: database dump to the server before migrations, migrations, zero-downtime switch after readiness check, smoke tests, automatic rollback, GitHub release tag with merged PRs.
- Workflow `rollback-production.yml` with the same guard, accepting only images that were deployed to production before.
- Production server bootstrap with the TASK-003 script; runbook updated.

## Out of scope
- Daily backups (TASK-022).
- Monitoring (TASK-023).

## Scenarios

### Scenario 1: Deploy
- When the user starts the production workflow with a commit that passed staging, then a dump is taken, migrations run and the new version serves traffic after a passing readiness check.

### Scenario 2: Automatic rollback (negative)
- When the smoke tests fail after deployment, then the previous image is restored automatically and the workflow fails.

### Scenario 3: Later rollback
- When the agent starts `rollback-production` with an image deployed to production before, then that image serves traffic after a passing readiness check and the user is informed.
- When an image that was never deployed to production is given, then the rollback workflow rejects it.

### Scenario 4: Wrong actor or branch (negative)
- When the workflow is started by another account or from a branch other than `main`, then it stops before using any secret.

## Technical notes
Needs from the user: production server (CX33), domain and DNS, repository secrets `PROD_*`. Only the user starts `deploy-production`; the agent may start `rollback-production` per AGENTS.md and informs the user immediately.

## Report
Filled in by development after the task.
