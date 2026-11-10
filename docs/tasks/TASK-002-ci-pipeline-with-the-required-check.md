---
id: TASK-002
title: CI pipeline with the required `check` job
status: DONE
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

**Done.** `.github/workflows/ci.yml`: job `check` runs `make check` (lint, types, tests with coverage, API contract), `make audit`, `make secrets` (gitleaks, full history) and `make images` (prod builds); job `publish` pushes `ghcr.io/michalwrzesinski/profilo-api:<sha>` and `profilo-client:<sha>` on main. `.github/dependabot.yml`: weekly uv, npm, Docker, Compose, GitHub Actions.

Acceptance criteria:
- Green pull request — verified on the PR run of this task (see PR).
- Images published — verified after merge (see PR comment / GHCR).
- Contract drift — met: `scripts/check_contract.py` exits 1 listing differences; unit tests cover extra field, missing field, undocumented path, method and status; run against a contract without `/ready` printed `/ready: path not in contract`.
- Leaked secret — met by the same gitleaks command that the pre-commit hook uses (TASK-001 verified it rejects a fake AWS key); in CI it scans the whole history.

Decisions:
- Coverage threshold raised from 80 % to 95 % (api and client), as the quality-checks standard requires; TASK-001 had set 80 % without basis. Added tests for DB/Valkey clients, lifespan and the request-context middleware (api 99.2 %).
- Audit policy: runtime dependencies fail on any advisory; dev-only npm advisories are printed but do not fail (they do not ship). Recorded in AGENTS.md.
- Checks run as the host uid (Makefile `AS_HOST`) to avoid EACCES on Linux runners; Vite cache moved to `/tmp/vite` and `node_modules/.vite-temp` made world-writable in the dev image.
- Base images pinned by digest; GitHub actions pinned by commit SHA; workflow linted with actionlint.

Limitations: CI rebuilds dev images without a layer cache (≈ a few minutes); the publish job uses the GitHub Actions cache.
