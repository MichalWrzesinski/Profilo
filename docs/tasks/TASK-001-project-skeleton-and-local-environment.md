---
id: TASK-001
title: Project skeleton and local environment
status: READY
priority: highest
iteration: ITER-00
depends_on: []
areas: [api, client, infra]
materials:
  - AGENTS.md
  - docs/architecture.md
  - docs/standards/development/devops.md
  - docs/design/tokens.css
---

## Goal
A developer starts the whole stack locally with `make up` and sees the Profilo placeholder page and healthy API.

## Scope
- `api/`: FastAPI app with module layout from architecture.md, settings from environment, structured JSON logging with request id, Problem Details error handler, `/health` and `/ready` (PostgreSQL and Valkey).
- `api/`: SQLAlchemy async session, Alembic configured with an empty initial migration, Celery app with `worker` and `beat` entry points.
- `client/`: Next.js 16 app with TypeScript strict, global `tokens.css`, Plus Jakarta Sans, placeholder home page using the brand logo and favicons from `docs/design/brand/`.
- `docker-compose.yml`: caddy, client, api, worker, beat, db (PostgreSQL 18), valkey, mailpit; `.env.example`.
- `Makefile`: `up`, `down`, `logs`, `migrate`, `test`, `lint`, `check`, `api-shell`, `hooks` (installs pre-commit).
- `.pre-commit-config.yaml` with gitleaks (secret scan of staged changes), Ruff and Prettier; installed by `make hooks` (compensates for missing GitHub secret scanning — AGENTS.md).
- README: local setup and commands; AGENTS.md: commands section and baseline check results.

## Out of scope
- Product features.
- CI and deployment (TASK-002, TASK-003).

## Scenarios

### Scenario 1: Stack starts
- When a developer with only Docker and make runs `make up` on a clean checkout, then all containers become healthy within 3 minutes.
- When `http://localhost:8080/` is opened, then the placeholder page with the Profilo logo is shown.
- When `GET /ready` is called, then it returns 200 with database and Valkey reachable.

### Scenario 2: Checks pass
- When `make check` runs, then lint, type checks and tests of api and client pass with zero errors.

### Scenario 3: Dependency down (negative)
- When the database container is stopped, then `GET /health` still returns 200 and `GET /ready` returns 503 in Problem Details format.

### Scenario 4: Secret in a commit (negative)
- When `make hooks` was run and a staged file contains a string matching a secret pattern, then the commit is rejected by gitleaks.

## Report
Filled in by development after the task.
