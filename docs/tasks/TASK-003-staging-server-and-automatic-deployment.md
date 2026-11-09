---
id: TASK-003
title: Staging server and automatic deployment
status: READY
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
Needs from the user before it can be completed: Hetzner account with the CX23 server (or API token), staging domain DNS (e.g. `staging.profilo.pl`), GitHub environment secrets for SSH. Until then the task can be implemented and tested against a local VM, and reported as waiting for access.

## Report
Filled in by development after the task.
