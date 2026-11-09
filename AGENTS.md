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
- CI/CD: GitHub Actions; required check `check`; images in GHCR; staging auto-deploy, production via protected `production` environment
- Monitoring: Sentry (EU region), Better Stack Uptime on `/ready`

## Project overrides of standards

- No admin panel in v1 (product brief); operator actions via CLI commands in the `api` image.
- Mode without an agent account (project-setup standard): the agent works on the user's GitHub account `MichalWrzesinski`. Rules forbidding changes to repository settings, branch protection and environments still apply, although not enforced technically. Production deployment (`Deploy production` workflow) is started and approved only by the user; the agent reports readiness and gives the workflow link (overrides deployment standard: the agent never starts the production workflow).

## Commands

Added in iteration 0.
