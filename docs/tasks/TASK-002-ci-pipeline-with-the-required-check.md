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

## Report
Filled in by development after the task.
