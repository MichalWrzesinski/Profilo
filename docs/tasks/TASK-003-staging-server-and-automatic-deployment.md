---
id: TASK-003
title: Staging server and automatic deployment
status: BLOCKED
priority: highest
iteration: ITER-00
depends_on: [TASK-002]
areas: [infra]
materials:
  - docs/decisions/0004-hosting-single-vps-docker-compose.md
  - docs/standards/development/deployment.md
  - docs/standards/development/devops.md
---

## Goal
Each merge to main is deployed automatically to staging and verified by smoke tests.

## Scope
- `infra/`: server bootstrap script (Docker, firewall: 22/80/443 only, unattended security upgrades, non-root deploy user), Compose file for staging/production, Caddyfile with TLS and security headers (HSTS, CSP, nosniff, Referrer-Policy, frame-ancestors).
- Workflow `deploy-staging.yml`: after CI on main, pull images by SHA on the staging server over SSH, run migrations, restart with health check, run smoke tests (`/ready`, home page 200).
- Runbook in `docs/runbook.md`: provisioning a server, secrets list, manual redeploy.

## Out of scope
- Production workflow, backups and monitoring (TASK-021).

## Scenarios

### Scenario 1: Automatic deploy
- When a commit lands on main and CI passes, then staging serves that commit within 10 minutes and the smoke tests pass.

### Scenario 2: Failed smoke test (negative)
- When the new version fails `/ready` after deployment, then the workflow fails, staging keeps or restores the previous image and the failure is visible in GitHub Actions.

### Scenario 3: HTTPS only
- When staging is opened over HTTP, then it redirects to HTTPS with HSTS and the security headers present.

## Technical notes
Set `FORWARDED_ALLOW_IPS` for the api to the Caddy container network so that client IPs from `X-Forwarded-For` are trusted only from Caddy (see AGENTS.md pitfalls).

Needs from the user before it can be completed: Hetzner account with the CX23 server (or API token), staging domain DNS (e.g. `staging.profilo.pl`), repository secrets for SSH (`STAGING_SSH_HOST`, `STAGING_SSH_KEY`; no GitHub environments on the free plan — AGENTS.md). Until then the task can be implemented and tested against a local VM, and reported as waiting for access.

## Report

**Implemented, blocked on access.** Waiting for the user: Hetzner CX23 server, staging DNS record, repository secrets `STAGING_SSH_HOST`, `STAGING_SSH_KEY`, `STAGING_SSH_KNOWN_HOSTS` and variable `STAGING_DOMAIN` (steps in `docs/runbook.md`). After that: run the workflow once, confirm the scenarios on the real server, set `DONE`.

Delivered: `infra/server/bootstrap.sh`, `compose.yml`, `Caddyfile`, `deploy.sh`; `.github/workflows/deploy-staging.yml` (after CI on main or manual, pinned SSH host key, short-lived GHCR login, deploy with rollback, external smoke tests incl. redirect and headers); `docs/runbook.md`.

Verified on a local Ubuntu 24.04 VM (OrbStack, `TLS_MODE=internal`, images built locally and loaded, `DEPLOY_SKIP_PULL=1`):
- Bootstrap: ufw allows only 22/80/443; `deploy` user in the docker group; SSH key login works, root login and passwords are refused; `.env` 600 with a generated DB password; re-run is idempotent.
- Scenario 1 (deploy): migrations, healthy stack and smoke tests in 31 s. Not verified on the real server or through the GitHub workflow (no access yet).
- Scenario 2 (failed version): an API image that never becomes healthy → `deploy.sh` exits 1, previous version restored in ≈ 80 s, `.deployed-tag` unchanged, `/ready` 200. Staging is unavailable for about a minute during such a failure (no zero-downtime on staging; production in TASK-021).
- Scenario 3 (HTTPS): HTTP → 308 to HTTPS; HSTS, CSP, nosniff, Referrer-Policy, Permissions-Policy, `X-Robots-Tag: noindex, nofollow`; no `Server` header; API docs 404.

Review round 1 fixes (verified on the VM):
- Releases in `/srv/profilo/releases/<sha>/` with a `current` symlink; Compose runs from the release directory, so rollback restores images *and* stack files (release B with a broken API and its own Caddyfile → release C restored, its `X-Test-Release: C` header served again, 77 s).
- Caddy is reloaded after start, so Caddyfile changes take effect (header changed between releases was served).
- Caddy and PostgreSQL receive only the variables they need (Caddy env: DOMAIN, TLS_MODE, ROBOTS_TAG, ACME_EMAIL).
- Smoke tests retry for up to 90 s (ACME issuance, Caddy start); deployments are serialised with `flock` (second run exits 3) and ignore SSH hang-ups; old releases beyond 5 are removed with their images, never the current or previous one.
- Workflow deploys only commits on main; after CI it skips a commit that is no longer the head of main.
- Bootstrap validates the deploy key (invalid key → stops before any change), fails if `sshd -t` or the reload fails, uses non-interactive dpkg options, enables automatic reboot at 04:00, takes `ACME_EMAIL`, warns when an existing `.env` differs from the arguments.
- Runbook: layout, helper for Compose commands, Recovery section. Proposed TASK-024 (CSP nonces).

Also confirmed: the CI `publish` jobs on main (`af0dd49`) succeeded, i.e. TASK-002 scenario 2.

Decisions:
- `FORWARDED_ALLOW_IPS` set to Caddy's fixed address `172.28.0.10` (narrower than the network).
- CSP allows `'unsafe-inline'` scripts and styles because Next.js injects inline scripts; nonces can replace it later.
- GHCR access on the server uses the workflow's `GITHUB_TOKEN` (`packages: read`) and logs out after the deployment — no long-lived registry credentials on the server.
- Fixes found by the VM test: `openssh-server` installed explicitly; `ROBOTS_TAG` quoted in `.env`.
