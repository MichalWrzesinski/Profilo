---
id: TASK-002
title: CI pipeline with the required `check` job
status: READY
priority: highest
iteration: ITER-00
depends_on: [TASK-001]
areas: [infra]
materials:
  - AGENTS.md
  - docs/standards/development/devops.md
  - docs/standards/development/quality-checks.md
  - docs/api/openapi.yaml
---

## Goal
Every pull request runs one required `check` job, and every merge to main publishes versioned images.

## Scope
- GitHub Actions workflow `ci.yml` with job named exactly `check`: lint, type checks, unit and integration tests (PostgreSQL and Valkey services), coverage report, OpenAPI contract compliance (spec generated from FastAPI vs `docs/api/openapi.yaml`), gitleaks secret scan, Docker build.
- On push to main: build and push `api` and `client` images to GHCR tagged with the commit SHA.
- Dependabot configuration for pip, npm, Docker and GitHub Actions (weekly).

## Out of scope
- Deployment (TASK-003).

## Scenarios

### Scenario 1: Green pull request
- When a pull request changes code, then the `check` job runs and reports success when all checks pass.

### Scenario 2: Images published
- When a commit lands on main, then images `ghcr.io/michalwrzesinski/profilo-api:<sha>` and `-client:<sha>` exist.

### Scenario 3: Contract drift (negative)
- When the API exposes an endpoint or field that differs from `docs/api/openapi.yaml`, then `check` fails with the difference listed.

### Scenario 4: Leaked secret (negative)
- When a commit contains a string matching a secret pattern, then `check` fails at the gitleaks step.

## Technical notes
Branch protection is not available (free plan); the agent treats a green `check` as mandatory before merging (AGENTS.md).

From the TASK-001 review, to handle here:
- Dev containers run as uid 999 (`app`) and 1000 (`node`) and write into bind mounts (`.coverage`, caches, `coverage/`, `next-env.d.ts`); on Linux runners (uid 1001) this may fail with EACCES — run CI checks so that they work on Linux (e.g. matching uid or no bind mount).
- Dependency audits: `npm audit --omit=dev` must be clean (0 today); dev dependencies have 8 moderate advisories (minimatch via eslint tooling) — report, do not fail on dev-only moderate; add `pip-audit` for the API.
- Base images are pinned to patch versions; add digests and Renovate/Dependabot updates for Docker tags.
- Beat healthcheck only checks that the schedule file exists — acceptable until beat has schedules (TASK-017).

## Report
Filled in by development after the task.
