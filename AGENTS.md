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
- E-mail: SMTP adapter in `notifications`; Brevo (staging and production, separate keys); Mailpit locally
- Frontend: Next.js 16 App Router, React 19, TypeScript strict, Node.js 26 LTS; one app for landing, `/user/{nick}` (SSR, no data cache) and panel
- Styling: CSS Modules + `docs/design/tokens.css`; components per `docs/design/design-system.html`; icons Lucide
- Forms and API client: React Hook Form + Zod; `openapi-typescript` + `openapi-fetch` generated from the contract; `@dnd-kit/sortable` for link order
- Code style frontend: ESLint + Prettier
- Tests: pytest + httpx (backend, coverage ≥ 80 % in modules), Vitest + Testing Library (frontend), Playwright (E2E main flow and smoke tests)
- UI language: Polish only; product docs and code in English
- Runtime: Docker Compose (caddy, client, api, worker, beat, db, valkey); same Compose for staging and production
- Hosting: Hetzner Cloud — production CX33, staging CX23, off-site backups to Storage Box (ADR 0004)
- CI/CD: GitHub Actions; required check `check`; images in GHCR; staging auto-deploy on main; production by `deploy-production` workflow started manually by the user (no GitHub environments — see overrides)
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

Added in iteration 0.
