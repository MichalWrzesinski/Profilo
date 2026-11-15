---
id: TASK-021
title: Production deployment and rollback
status: IN_PROGRESS
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
From TASK-003: `deploy.sh` recreates Caddy on every release (its config directory is the release directory) and restarts the app containers in place — production needs a zero-downtime variant (e.g. a long-lived Caddy with `caddy reload` and app containers started side by side).

Needs from the user: production server (CX33), domain and DNS, repository secrets `PROD_*`. Only the user starts `deploy-production`; the agent may start `rollback-production` per AGENTS.md and informs the user immediately.

## Report

**Implemented, waiting for the production server.** Delivered:
- `infra/server/deploy.sh` (staging and production):
  - `pg_dump` before migrations, checked with `pg_restore --list` (newest 5 in `backups/`);
  - **zero-downtime switch**: per service (`api`, then `client`) a container of the new release starts beside the old one (`up --no-deps --no-recreate --scale`); the old one stops gracefully only after the new one is healthy and the API's `/ready` passes. Caddy retries failed connections for 10 s (`lb_try_duration`). `worker`/`beat` are replaced in place;
  - Caddy stays up across releases: it reads `$APP_DIR/caddy/Caddyfile`, copied from the release and reloaded;
  - new containers that never get healthy are removed and nothing is switched back (the running release kept serving); smoke tests failing after the switch → previous release switched back the same way;
  - `.deployed-history`; `--rollback` only to a commit in it; a commit deployed before never runs its migrations again.
- `infra/ci/deploy-remote.sh`: runner side shared by the three workflows (previously inline in `deploy-staging.yml`); always taken from `main`, stack files from the deployed commit.
- `deploy-production.yml`: `workflow_dispatch`, job skipped unless `refs/heads/main` and actor *and* triggering actor (re-runs) are `MichalWrzesinski` — no secret is evaluated otherwise; requires the commit status `deploy/staging = success` (now set by *Deploy staging* after verification); GitHub release `production-<UTC time>` with generated notes since the previous `production-*` tag.
- `rollback-production.yml`: same guard; refuses a commit without a `production-*` tag before touching secrets, and the server refuses one missing from `.deployed-history` (exit 4).
- `bootstrap.sh` fix found while provisioning the test VM: on Ubuntu 24.04 with `ssh.socket` the inactive `ssh.service` cannot be reloaded, so the script stopped; now only a running sshd is reloaded.
- Runbook: *How a deployment works* rewritten, new *Production* section (provision, `PROD_*` settings, readiness report, deploy, later rollback), recovery entries, dump restore (with consent).

Verified on a local Ubuntu 24.04 VM (OrbStack) bootstrapped as production (`bootstrap.sh production … internal`), with locally built production images tagged as releases A–E and a request loop during every deployment (`/`, `/ready`, a public API 404, a login POST; ~1 000–2 000 requests each):
- Scenario 1: first deployment A, then B: dump taken (valid archive, 9 tables with data), migrations, `api` and `client` switched, Caddy not recreated — **0 failed requests of 6 748**.
- Scenario 2 (release that fails after the switch — Caddyfile pointing the API to a wrong port): smoke test failed, previous release with its Caddyfile switched back, exit 1, `current` and history unchanged; failed requests only while the broken release served.
- New API never healthy: removed, "failed before taking traffic; the running release was not changed", 0 failed requests.
- Scenario 3: `--rollback` to a commit never deployed → refused (exit 4); to an earlier release → switched without migrations, 0 failed requests.
- Moving from the current staging layout (Caddy mounting the release directory) recreates Caddy once: ~2 s of failed requests. Happens once on staging; production starts with the new layout.
- shellcheck and actionlint clean.

Not verified: the workflows themselves against a real production server (none yet) — the agent must not start *Deploy production* (AGENTS.md); scenario 4 (another account / another branch) only by reading the job condition. The staging workflow (refactored onto `deploy-remote.sh`, now setting `deploy/staging`) is verified by the automatic deployment after this merge. "Error count in the first minutes" (deployment standard, step 4) needs Sentry (TASK-023).

Needs from the user: production server (CX33, or the shared VPS with `setup-shared-host.sh production`), the production domain and DNS, `PROD_*` secrets and variables (runbook *Production*), an SMTP account whose port the server can reach, and a dedicated sender address.

Decisions:
- Blue-green per service inside one Compose project (scale to two, then remove the old container) instead of two full stacks: one database, one Valkey, one Caddy; no second set of ports; Caddy's DNS-based upstream with retries absorbs the switch.
- Pre-migration dumps stay on the server (5 newest); off-site copies are TASK-022.
- "Verified on staging" is a commit status set by the staging workflow rather than a lookup of workflow runs (a manual staging run's head SHA is not the deployed commit).
- Rollback eligibility is checked twice: the `production-*` tag (before any secret) and the server's own history (what actually ran there).
- External smoke-test failures do not roll back: the release passed on the server; the cause is in front of it.
