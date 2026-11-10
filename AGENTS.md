# Profilo — instructions for agents

Personal business-card pages (Polish-language competitor of about.me). Standards: `docs/standards/` (set 1.4.0, see `docs/standards/COPY.md`) — follow this copy. Product: `docs/product/`. Design: `docs/design/`. Architecture: `docs/architecture.md`. API contract: `docs/api/openapi.yaml`.

## Technical profile

- Backend: Python 3.15, FastAPI, Pydantic 2, SQLAlchemy 2 (async, asyncpg), Alembic migrations
- Code style backend: Ruff (lint + format), mypy strict
- Database: PostgreSQL 18; time as `timestamptz` UTC; public ids UUID v7
- Cache / rate limiting / broker: Valkey 9
- Background jobs: Celery 5 + Celery Beat (single instance)
- API: REST JSON, `/api/v1`, camelCase fields, Problem Details (RFC 9457) with `code`, page pagination (`page`, `perPage`, default 20, max 100), contract-first OpenAPI 3.1 checked in CI
- Auth: JWT access token 15 min (PyJWT, HS256) in memory; rotating refresh token in HttpOnly `SameSite=Strict` cookie, 30 days; Argon2id via pwdlib
- Bot protection: ALTCHA (self-hosted proof-of-work) on registration after threshold
- Files: user images on a persistent volume via fsspec; Pillow processing, EXIF stripped, WebP variants; served via `/media/**` through the API
- E-mail: SMTP adapter in `notifications` (Jinja2 templates; Celery task retries only transient errors — 4xx, connection — with exponential backoff and full jitter, at most ~8 min; 5xx/authentication fail at once; `email_failed` logged at error level with the SMTP code only, never provider text with addresses); Brevo on servers via `.env.secrets` written by the deploy workflow; Mailpit locally
- Frontend: Next.js 16 App Router, React 19, TypeScript strict, Node.js 26 LTS; one app for landing, `/user/{nick}` (SSR, no data cache) and panel
- Styling: `docs/design/tokens.css` and `docs/design/components.css` imported globally (design-system class names), CSS Modules for page layout; icons Lucide
- Forms and API client: React Hook Form + Zod; `openapi-typescript` + `openapi-fetch` generated from the contract; `@dnd-kit/sortable` for link order
- Code style frontend: ESLint + Prettier
- Tests: pytest + httpx (backend), Vitest + Testing Library (frontend), Playwright (E2E main flow and smoke tests); coverage threshold 95 % per app (quality-checks standard)
- Contract check: `api/scripts/check_contract.py` compares the FastAPI spec with `docs/api/openapi.yaml` (implemented paths, methods, 2xx statuses, request/response property names recursively; an object with fields on one side only is a difference)
- Dependency audits: `pip-audit` (runtime deps, hashes) and `npm audit --omit=dev` fail on any advisory; dev-only npm advisories fail at high/critical, moderate/low are reported only
- Images: base images pinned to patch version + digest; Dependabot weekly for uv, npm, Docker, Compose, GitHub Actions
- UI language: Polish only; product docs and code in English
- Runtime: Docker Compose (caddy, client, api, worker, beat, db, valkey); same Compose for staging and production
- Hosting: Hetzner Cloud — production CX33, staging CX23, off-site backups to Storage Box (ADR 0004)
- CI/CD: GitHub Actions `ci.yml` (job `check` runs `make check audit secrets` and the prod builds, with a GHA layer cache; `publish` pushes `ghcr.io/michalwrzesinski/profilo-{api,client}:<sha>` on main); actions pinned to commit SHAs; images in GHCR; staging auto-deploy on main; production by `deploy-production` workflow started manually by the user (no GitHub environments — see overrides)
- Servers: Ubuntu 24.04 prepared by `infra/server/bootstrap.sh` (Docker, ufw 22/80/443, unattended upgrades, `deploy` user with SSH key only); stack `infra/server/compose.yml` + `Caddyfile` in `/srv/profilo`; `deploy.sh <sha>` pulls, migrates, starts with health checks, smoke-tests and restores the previous version on failure (docs/runbook.md)
- Staging deploy: `.github/workflows/deploy-staging.yml` after CI succeeds on main (or manually with a SHA); secrets `STAGING_SSH_HOST`, `STAGING_SSH_KEY`, `STAGING_SSH_KNOWN_HOSTS`, variable `STAGING_DOMAIN`
- Monitoring: Sentry (EU region), Better Stack Uptime on `/ready`

## Project overrides of standards

- No admin panel in v1 (product brief); operator actions via CLI commands in the `api` image.
- Mode without an agent account (project-setup standard): the agent works on the user's GitHub account `MichalWrzesinski`. Rules forbidding changes to repository settings, branch protection and environments still apply, although not enforced technically. Production deployment (`deploy-production` workflow) is started only by the user (rollback: see below); the agent reports readiness and gives the workflow link (overrides deployment standard: the agent never starts the production workflow).
- Free GitHub plan for a private repository (user decision 2026-11-09): no branch protection, no GitHub environments (so no environment secrets and no deployment approval), no GitHub secret scanning. Compensation:
  - The agent never pushes to `main` and merges only through a PR with a green `check` and an approving review by the reviewer subagent.
  - Secrets are repository-level. Only `deploy-staging`, `deploy-production` and `rollback-production` reference deployment secrets; the agent never adds secret references to other workflows. Production secret names are prefixed `PROD_`.
  - `deploy-production` and `rollback-production` run only on `workflow_dispatch` from `main` and stop unless `github.actor == 'MichalWrzesinski'`. This guard only blocks other accounts: the agent acts as the same account, so keeping the agent away from production is a behavioural rule, not a technical control.
  - Starting `deploy-production` is the user's approval; the agent never starts it. `rollback-production` follows the deployment standard: the agent may start it without consent (only images deployed to production before) and informs the user immediately.
  - Secrets needed at runtime (Sentry, Brevo, Storage Box, uptime keys) reach the servers only through the deploy workflows; release creation and source-map upload to Sentry also happen there, never in `ci.yml`.
  - Secrets: gitleaks as a local pre-commit hook and in the `check` job (both added in iteration 0). A secret is caught before commit locally, but after push if the hook is bypassed — accepted gap.
- Pre-commit hook is a plain script in `.githooks/pre-commit` (installed by `make hooks`), not the `pre-commit` framework named in TASK-001: the framework needs Python on the host, which conflicts with the devops standard (only Docker and make). It runs gitleaks, then Ruff and Prettier on the staged content using the dev images from `make up`.
- `scripts/setup-github.sh` changes repository settings, so only the user runs it (e.g. again after upgrading to GitHub Pro, which would restore branch protection and environments).

## Conventions

- Commit area tags by path (first matching row wins). Task tag: `[TASK-NNN]` from `docs/tasks/`.

  | Path | Tag |
  |---|---|
  | `api/**` (incl. `api/Dockerfile`, migrations, tests) and `docs/api/openapi.yaml` | `[api]` |
  | `client/**` (incl. `client/Dockerfile`, unit tests) and `docs/design/tokens.css` | `[client]` |
  | `e2e/**` (Playwright) | `[client]` |
  | `infra/**`, `.github/**`, `.claude/**`, `docker-compose*.yml`, `Makefile`, `.env.example`, `.pre-commit-config.yaml`, `scripts/**`, other root config files | `[infra]` |
  | `docs/**` (other than above), `README.md`, `AGENTS.md`, `CLAUDE.md` | `[docs]` |

  A contract change in `docs/api/openapi.yaml` goes into the `[api]` commit that implements it, before the `[client]` commit that uses it.
- No AI attribution in commits or PRs (git-workflow standard).

## Commands

- `make up` (first run creates `.env`), `make down`, `make logs`, `make migrate`, `make seed`, `make check` (= lint + test + contract), `make audit`, `make secrets`, `make images`, `make ci` (all of the CI job), `make format`, `make api-shell`, `make hooks`.
- Only Docker and make are needed; tools run in containers (`docker compose run --rm api|client …`). Host Node/Python versions are irrelevant.
- Backend tests use the `profilo_test` database (`TEST_DATABASE_URL`), created by `infra/postgres/init/`.
- Checks run as the host user (`--user $(id -u):$(id -g)`) so they work on Linux runners; the client image keeps `node_modules/.vite-temp` world-writable for that.
- Baseline (TASK-002): backend 27 tests, coverage 99.2 %; client 1 test, coverage 100 % (threshold 95 % both); Ruff, mypy strict, ESLint, Prettier, `tsc` clean; pip-audit and npm prod audit clean; npm dev audit: 7 moderate (typescript-eslint/minimatch).

## Pitfalls

- Celery workers do not reload code: after changing tasks run `docker compose restart worker beat`; after `docker compose build api` recreate the containers (`docker compose up -d api worker beat`), otherwise they keep the old image. The Next.js dev server can keep stale module state after switching branches: `docker compose restart client`.

- `client/src/lib/api/client.ts`: only the exact token endpoints (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/accounts`) are sent without the access token; any other endpoint, also under `/auth/`, gets it.
- After changing `docs/api/openapi.yaml`, regenerate client types with `docker compose run --rm client npm run api:types`; `make lint` fails when they are out of date.
- Nick rules live twice — `api/app/modules/profiles/nicks.py` and `client/src/lib/nick.ts`; change both and keep their test cases identical. Forms that send credentials use `method="post"` so a submit before hydration never puts them in the URL.
- API tests use Valkey database 1 and truncate tables per test (`clean_state` fixture); never point them at a shared database.

- ESLint stays on 9 (marked unsupported upstream) because `eslint-config-next` 16 depends on `eslint-plugin-import`, `eslint-plugin-react` and `eslint-plugin-jsx-a11y`, which all cap ESLint at 9; Dependabot ignores ESLint majors. Migration: TASK-025.
- `vitest` and `@vitest/*` must be updated together (Dependabot group `vitest`).

- The client image is built with the repository root as context (`client/Dockerfile`, root `.dockerignore`) because the app imports `docs/design/tokens.css`. Fonts come from `next/font` (self-hosted); do not add the Google Fonts `@import` to the app.
- Local ports bind to `127.0.0.1` only (8080 app, 8025 Mailpit).
- The API trusts `X-Forwarded-*` only from `FORWARDED_ALLOW_IPS` (uvicorn default `127.0.0.1`); staging/production must set it to the Caddy container network, otherwise client IPs (rate limits) are wrong.
- The API has no access log by design (no visitor IPs in app logs); request ids link Caddy and API logs.
- Compose named volumes `client_node_modules` and `client_next` shadow the bind mount; after changing `package.json` run `docker compose build client` and `docker compose up -d --renew-anon-volumes client` (or `make down` + remove the volume).
