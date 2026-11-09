---
id: TASK-001
title: Project skeleton and local environment
status: DONE
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

**Done.** `make up` on a clean checkout starts 8 healthy containers (caddy, client, api, worker, beat, db, valkey, mailpit); `http://localhost:8080/` shows the Profilo placeholder with the logo; `/ready` checks PostgreSQL and Valkey; migration `0001` (citext) applied.

Acceptance criteria:
- Stack starts — met; all containers healthy (start time on this machine with cached base images ≈ 1 min; a first build downloads ≈ 1 GB of images).
- Checks pass — met: backend 11 tests, coverage 90.6 %, Ruff + mypy strict clean; client 1 test, coverage 100 %, ESLint, Prettier, `tsc` clean.
- Dependency down — met: with `db` stopped, `/health` 200 and `/ready` 503 `application/problem+json`, `code: dependency_unavailable`, `Retry-After: 5`.
- Secret in a commit — met: the hook rejected a staged AWS key.

Decisions:
- Git hook is a plain script in `.githooks/` (installed by `make hooks` via `core.hooksPath`) running gitleaks, Ruff and Prettier in Docker, instead of the `pre-commit` framework with `.pre-commit-config.yaml`: the framework needs Python on the host, which conflicts with the devops standard (only Docker and make). Same checks, different mechanism.
- Fonts via `next/font` (self-hosted); the Google Fonts `@import` was moved from `docs/design/tokens.css` to `<link>` tags in the mockup pages, so visitors' browsers never contact Google (GDPR). Verified: no Google references in the production build.
- Client image built from the repository root so the app imports `docs/design/tokens.css` directly (single source of tokens). Brand files copied to `client/public/`.
- Backend tests run against a separate `profilo_test` database created by `infra/postgres/init/`.

Limitations: no CI yet (TASK-002); local Caddy has no security headers yet (TASK-003); `make seed` has no data until the first features.
