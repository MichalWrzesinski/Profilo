---
id: TASK-021
title: Production deployment and rollback
status: BLOCKED
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
  - `pg_dump` before every migration, checked with `pg_restore --list` (newest 5 in `backups/`);
  - migrations unless the database is at a revision the release does not know (read from `alembic_version`, checked against the release's migrations) — right for rollbacks and after a restored dump; any other error stops before anything changes;
  - **blue-green**: `api-blue`/`client-blue` and `api-green`/`client-green` in `compose.yml` (profiles; each client calls the API of its colour). The release starts in the idle colour; Caddy is pointed at it (`caddy/upstreams.caddy`, graceful reload) only after its containers are healthy and the API's `/ready` passes. Caddy stays up across releases (reads `$APP_DIR/caddy/`);
  - smoke tests after the switch; on failure Caddy is pointed back at the previous colour, which is still running; `worker`/`beat` are replaced only after the smoke tests (and restored on a switch back); the old colour stops last;
  - `.deployed-history`; `--rollback` only to a commit in it (exit 4 otherwise); a dump before every migration that may run (also in a rollback after a restore);
  - `caddy/live` names the colour Caddy loaded, written after each successful reload; an unknown colour stops the run.
- `infra/ci/deploy-remote.sh`: runner side shared by the three workflows (previously inline in `deploy-staging.yml`); always from `main`; refuses to upload while a deployment still runs on the server.
- `deploy-production.yml`: `workflow_dispatch`, job skipped unless `refs/heads/main` and actor *and* triggering actor (re-runs) are `MichalWrzesinski` — no secret is evaluated otherwise; requires the commit status `deploy/staging = success`; the deploy job has a read-only token (handed to the server for GHCR), a separate `release` job creates `production-<UTC time>` with generated notes since the previous tag.
- `rollback-production.yml`: same guard; refuses a commit without a `production-*` tag before touching secrets; the server refuses one missing from `.deployed-history`.
- `deploy-staging.yml`: uses the shared script; a separate job with `statuses: write` sets `deploy/staging` after a verified deployment.
- `bootstrap.sh` fix found while provisioning the test VM: on Ubuntu 24.04 with `ssh.socket` the inactive `ssh.service` cannot be reloaded, so the script stopped; now only a running sshd is reloaded.
- Runbook: *How a deployment works* rewritten, new *Production* section (provision, `PROD_*` settings, readiness report, deploy, later rollback), operator commands on the live colour (`live` helper), recovery entries, dump restore (with consent).

Verified on a local Ubuntu 24.04 VM (OrbStack) bootstrapped as production (`bootstrap.sh production … internal`), locally built production images tagged as test releases, and a request loop during every run (`/`, `/ready`, a public API 404, a login POST; failures = anything but 200/401/404/429):
- Scenario 1: blue → green with dump and migrations — **0 failed of 4 576 requests**; again green → blue, 0 of 3 936.
- New API never healthy — not switched, 0 failed of 1 852. New API healthy but not ready (a server answering 404 on `/ready`) — never received traffic, 0 failed of 6 540.
- Scenario 2 (release failing after the switch — Caddyfile sending the API to a closed port): smoke test failed after 90 s, Caddy pointed back at the previous colour in about 1 s, previous release serving, exit 1, `current` and history unchanged; failures only while the broken release served.
- Scenario 3: `--rollback` to a commit never deployed → refused (exit 4); to an earlier release while the database is at a newer revision → "migrations skipped", switched, 0 failed of 4 516.
- Migration decision: known revision → `upgrade head`; unknown (newer) → skipped; unreadable (wrong database) → "could not read the database revision", nothing changed.
- Switch back to the old layout (old layout → release failing after the switch): back to `api`/`client` with the old Caddy configuration (`caddy/live = legacy`); the next deployment recognised it, started blue and removed the old containers. Restoring the old layout also restores Caddy's old mount, so the next deployment recreates Caddy once more (~2 s).
- Move from the current staging layout (services `api`/`client`, Caddy mounting the release directory) recreates Caddy once: ~2 s of failed requests (88 of 4 200). Once on staging; production starts with the new layout.
- shellcheck and actionlint clean.

Not verified: the workflows against a real production server (none yet) — the agent must not start *Deploy production* (AGENTS.md); scenario 4 (another account / another branch) only by reading the job condition; a copy of the workflow changed on a branch runs with the repository secrets (accepted gap of the free plan, AGENTS.md). The staging workflow (refactored, now setting `deploy/staging`) is verified by the automatic deployment after this merge. "Error count in the first minutes" (deployment standard, step 4) needs Sentry (TASK-023). Next.js graceful shutdown is not relied on: the old colour stops only after Caddy routes away from it.

Review (subagent, code review + security), round 2: switching back to the old layout left an upstream file the next run misread (→ `caddy/live` marker, unknown colours rejected), duplicate report section, stale runbook texts, no dump before a migration in rollback mode, no guard on the release job — fixed.

Review round 1: 2 major, 6 minor, 3 nits; fixed:
- new containers got traffic before they were ready (Docker DNS adds a scaled container at once) → blue-green with an explicit Caddy switch after `/ready`, verified with a healthy-but-not-ready API;
- the token handed to the production server had `contents: write` (staging: `statuses: write`) → read-only deploy jobs, writes in separate jobs;
- skipping migrations by history broke after a restored dump → decided by the database's revision (found while testing: `alembic current` prints `FAILED:` on stdout, so the revision is read with `psql`);
- leftover containers counted and restarted, ignored results of `caddy reload` and `docker stop` → leftovers of the idle colour are removed first, every step's result is checked;
- a rerun during a running deployment replaced its files and truncated its log → lock checked before upload and before the log is truncated;
- keep-alive race on the old container → gone (Caddy routes away before it stops); curl errors in the external smoke test now give a message; `deploy/staging` limits documented.
- Not changed: rollbacks run the release's own `deploy.sh` (reviewer suggested main's): `deploy.sh` and the compose files of a commit are one contract — main's script with an older compose file would be the worse mismatch. Production releases all have this layout; on staging, redeploying a commit older than this task runs its old script, and the next deployment moves back to blue-green.

Needs from the user: production server (CX33), domain and DNS, repository secrets `PROD_*`. Only the user starts `deploy-production`; the agent may start `rollback-production` per AGENTS.md and informs the user immediately.

Decisions:
- Blue-green of the app services inside one Compose project (one database, one Valkey, one Caddy; no second set of ports); the switch is a Caddy reload, so the previous colour stays ready for an instant switch back until the release is verified. (First attempt — two containers under one service name — let Docker DNS send traffic to a new container before it was ready; replaced after review.)
- Pre-migration dumps stay on the server (5 newest); off-site copies are TASK-022.
- "Verified on staging" is a commit status set by the staging workflow rather than a lookup of workflow runs (a manual staging run's head SHA is not the deployed commit).
- Rollback eligibility is checked twice: the `production-*` tag (before any secret) and the server's own history (what actually ran there).
- External smoke-test failures do not roll back: the release passed on the server; the cause is in front of it.
