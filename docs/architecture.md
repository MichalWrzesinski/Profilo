# Architecture

Modular monolith. Product areas: `docs/product/areas/`. Decisions: `docs/decisions/`. API contract: `docs/api/openapi.yaml`.

## Runtime

```mermaid
flowchart LR
    V[Browser] -->|HTTPS| C[Caddy<br/>TLS, security headers]
    C -->|/api/*, /media/*| A[api<br/>FastAPI]
    C -->|everything else| N[client<br/>Next.js SSR]
    N -->|server-side fetch /api/v1| A
    A --> P[(PostgreSQL 18)]
    A --> K[(Valkey<br/>rate limits, broker)]
    A --> F[(media volume<br/>via fsspec)]
    W[worker + beat<br/>Celery] --> P
    W --> K
    W --> F
    W -->|SMTP/API| E[E-mail provider]
```

| Container | Responsibility |
|---|---|
| `caddy` | TLS (Let's Encrypt), HSTS, CSP and other headers, routing, gzip/zstd |
| `client` | Next.js: landing, legal pages, `/user/{nick}` (SSR, no cache), owner panel (client components) |
| `api` | FastAPI `/api/v1/**`, `/media/**`, `/health`, `/ready` |
| `worker` | Celery tasks: e-mails, image processing, cleanup |
| `beat` | Celery Beat schedule (single instance) |
| `db`, `valkey` | PostgreSQL 18, Valkey 9 |

## Backend modules (`api/app/modules/`, shared code in `api/app/core/`)

| Module | Product area | Owns tables | Public interface for other modules |
|---|---|---|---|
| `accounts` | Accounts | `accounts`, `refresh_tokens`, `one_time_tokens` | `get_account`, `is_email_confirmed`, `delete_account` (emits `AccountDeleted`) |
| `profiles` | Profile, Public page | `profiles`, `profile_links`, `published_profiles`, `reserved_nicks` | `create_profile_for(account)`, `get_public_profile(nick)`, `block(nick)` |
| `media` | Profile (images) | `images` | `store_upload(...)`, `url_for(image, size)`, `delete_for_account(id)` |
| `notifications` | All | — | `send(template, to, params)` as a Celery task; templates in Polish |
| `qr` | Public page | — | `render(url, format)` |
| `core` (`api/app/core/`) | — | — | settings, DB session, Valkey client, request context, Problem Details, logging, health; later auth dependencies, rate limiter, storage adapter |

Rules: a module reads and writes only its own tables; other modules call its service functions. Account deletion: `accounts` deletes the account in one transaction (FK cascades remove profile, links, snapshot, image rows), then enqueues `media.delete_files(account_id)` and the "account deleted" e-mail. `ops` CLI commands (`profilo block-profile <nick>`, `unblock-profile`) cover operator actions (PUB-BR-10) — no admin panel in v1.

## Frontend (`client/`)

- Next.js App Router, TypeScript strict, styling: CSS Modules + `docs/design/tokens.css` imported globally; components follow `docs/design/components.css` and `design-system.html`.
- API types and client generated from `docs/api/openapi.yaml` (`openapi-typescript` + `openapi-fetch`).
- Forms: React Hook Form + Zod schemas mirroring the contract; autosave with debounce 1 s (PRF-BR-14).
- Link reordering: `@dnd-kit/sortable` with keyboard support and ↑/↓ buttons on mobile.
- Access token in memory, refreshed via `POST /api/v1/auth/refresh` (HttpOnly cookie).

## Data model

```mermaid
erDiagram
    ACCOUNT ||--o{ REFRESH_TOKEN : has
    ACCOUNT ||--o{ ONE_TIME_TOKEN : has
    ACCOUNT ||--|| PROFILE : owns
    ACCOUNT ||--o{ IMAGE : uploads
    PROFILE ||--o{ PROFILE_LINK : contains
    PROFILE ||--o| PUBLISHED_PROFILE : "published as"
    PROFILE }o--o| IMAGE : "avatar / background"

    ACCOUNT {
        uuid id PK
        citext email UK "login e-mail, never public"
        text password_hash "Argon2id"
        timestamptz email_confirmed_at "null = unconfirmed"
        timestamptz created_at
        timestamptz password_changed_at
    }
    REFRESH_TOKEN {
        uuid id PK
        uuid account_id FK "cascade"
        bytea token_hash UK
        uuid family_id "reuse detection"
        timestamptz expires_at
        timestamptz revoked_at
    }
    ONE_TIME_TOKEN {
        uuid id PK
        uuid account_id FK "cascade"
        text purpose "email_confirmation | password_reset"
        bytea token_hash UK
        timestamptz expires_at
        timestamptz used_at
    }
    PROFILE {
        uuid id PK
        uuid account_id FK,UK "cascade"
        citext nick UK "null until wizard step 1"
        boolean nick_locked "true after first publication"
        text display_name "1-60"
        text headline "0-80"
        text bio "0-500"
        text city
        text company
        text position
        text public_email
        text public_phone "E.164"
        text layout "classic | split | card"
        text accent "granat ... fiolet"
        uuid avatar_image_id FK
        uuid background_image_id FK
        text status "never_published | published | unpublished"
        timestamptz blocked_at "operator block"
        int version "optimistic lock"
        timestamptz draft_updated_at
    }
    PROFILE_LINK {
        uuid id PK
        uuid profile_id FK "cascade"
        smallint position "unique per profile"
        text label "1-40"
        text url "http/https, max 2000"
        text service "linkedin | github | ... | other"
    }
    PUBLISHED_PROFILE {
        uuid profile_id PK,FK "cascade"
        jsonb content "PublishedProfileV1 snapshot"
        smallint schema_version
        timestamptz published_at
    }
    IMAGE {
        uuid id PK
        uuid account_id FK "cascade"
        text kind "avatar | background"
        text storage_key "random, outside web root"
        int width
        int height
        timestamptz created_at
    }
    RESERVED_NICK {
        citext nick PK
        text reason "system | offensive | quarantine"
        timestamptz expires_at "null = permanent"
    }
```

Key constraints: `CHECK` on all lengths and enums; `CHECK (nick ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(nick) BETWEEN 3 AND 40)`; nick uniqueness checked against `profiles.nick` and `reserved_nicks` in one transaction (`SELECT … FOR UPDATE` on the reserved row, unique index on `profiles.nick`); `UNIQUE (profile_id, position) DEFERRABLE` for link reordering; at most 20 links enforced in the service and by a trigger-free count check in the same transaction.

Public read path: `GET /api/v1/public/profiles/{nick}` → `profiles` by nick where `status = 'published' AND blocked_at IS NULL` → `published_profiles.content`. Anything else → the same 404 (PUB-BR-6).

## Media

- Upload: `multipart/form-data` to the API, max 10 MB (Caddy limits the body to 11 MB, the API checks `Content-Length` before parsing), type detected from content (Pillow, JPEG/PNG/WebP only), 24 Mpx limit against decompression bombs, at most two images decoded at a time, EXIF orientation applied and all metadata dropped, converted to WebP (the JPEG fallback for Open Graph comes with TASK-013).
- Sizes: avatar 128/256/512 px square; background 960/1600/2400 px wide.
- Served by `GET /media/{imageId}/{size}.webp` through the API: allowed when the image belongs to the owner (draft preview, authenticated) or is referenced by a visible published snapshot. URLs never change content (new upload = new id); published images are cached for a day (`public, max-age=86400`) so unpublishing or blocking takes effect soon, drafts are `private, no-store`.

## Authentication

- Access token: JWT (PyJWT, HS256 with a 256-bit secret, `iss`/`aud`/`exp` checked), 15 min, in memory in the browser; the client refreshes it 60 s before expiry.
- Refresh token: random 256-bit, stored as SHA-256 hash, 30 days sliding (ACC-BR-8), rotated on every use with reuse detection by family (a reuse within 30 s — parallel tabs, a lost response — gets a sibling token; later reuse revokes the family); HttpOnly, Secure, `SameSite=Strict`, path `/api/v1/auth`. Refresh and logout additionally require header `X-Requested-With: profilo` (CSRF defence in depth).
- Passwords: Argon2id via `pwdlib`; common password check against the ~30 000 most common passwords bundled with `zxcvbn` (no external call).
- E-mail confirmation and password reset tokens: random, hashed, single-use, 48 h / 1 h.

## Personal and sensitive data

| Data | Where | Protection |
|---|---|---|
| Login e-mail | `accounts.email` | Never returned by public endpoints; not in logs (account id only) |
| Password | `accounts.password_hash` | Argon2id |
| Refresh / one-time tokens | `refresh_tokens`, `one_time_tokens` | Stored as hashes only |
| Public e-mail, phone, name, bio, city, company, position | `profiles`, `published_profiles` | Public only when the owner fills them in and publishes; deleted with the account |
| Photos | `images`, media volume | EXIF removed; served only for owner or visible pages; deleted with the account |
| IP addresses | Valkey rate-limit keys | TTL ≤ 1 h; not stored in the database; logs keep IP only in Caddy access logs, 14 days |

Retention: unconfirmed accounts deleted after 7 days; deleted accounts removed immediately (backups age out after 30 days — stated in the privacy policy).

## Higher-risk flows

| Flow | Risk | Mitigation |
|---|---|---|
| Login, registration, reset | Credential stuffing, enumeration, mailbombing | Rate limits per IP and per e-mail in Valkey; identical responses for login and reset; registration may reveal an existing e-mail (409 `email_taken`, pointing to login and reset) but has a low per-IP limit and a self-hosted proof-of-work challenge (ALTCHA, no third-party processor) after 3 attempts per IP per hour |
| Session | Token theft | Short access token, rotating refresh with reuse detection, revoke all on password change/reset |
| Profile content | Stored XSS, phishing links | React escaping; URLs restricted to `http`/`https`; `rel="nofollow ugc noopener noreferrer"`; strict CSP |
| Image upload | Malicious files, metadata leaks | Content sniffing, size and pixel limits, re-encoding, EXIF removal, random keys, no direct file serving |
| Nick | Takeover of shared addresses, impersonation | Nick locked after first publication; 30-day quarantine after deletion; reserved list |
| Unpublish / block | Stale content visible | No caching of public pages; snapshot visibility checked on every request |
| Account deletion | Accidental or hostile deletion | Password required; confirmation e-mail; cascade in one transaction |

## Code map

| Path | Responsibility | State |
|---|---|---|
| `api/app/main.py` | FastAPI app factory: error handlers, request-context middleware, routers | TASK-001 |
| `api/app/core/settings.py` | Settings from environment (`Settings`, `get_settings`) | TASK-001 |
| `api/app/core/db.py` | Async SQLAlchemy engine, session dependency, declarative `Base` | TASK-001 |
| `api/app/core/valkey.py` | Shared Valkey (Redis protocol) client | TASK-001 |
| `api/app/core/errors.py` | Problem Details responses, `ProblemError`, handlers for HTTP and validation errors | TASK-001 |
| `api/app/core/request_context.py` | Pure ASGI middleware: `X-Request-ID`, log context, single log + 500 Problem for unhandled errors | TASK-001 |
| `api/app/core/health.py` | `/health`, `/ready` (PostgreSQL and Valkey in parallel, one timeout) | TASK-001 |
| `api/app/core/logging.py` | structlog JSON to stdout; uvicorn access log disabled | TASK-001 |
| `api/app/worker.py` | Celery app (`worker`, `beat`), task autodiscovery per module package | TASK-001 |
| `api/app/modules/<module>/` | Product modules (empty packages until their tasks) | — |
| `api/alembic/` | Migrations (`0001`: citext extension) | TASK-001 |
| `api/tests/` | pytest; integration tests use the `profilo_test` database | TASK-001 |
| `api/app/core/auth.py`, `core/rate_limit.py`, `core/schemas.py` | Bearer-token dependency, Valkey fixed-window limits (fail open), camelCase API base model | TASK-004 |
| `api/app/modules/accounts/` | Accounts and refresh tokens: models, Argon2id + common-password policy, JWT and rotating refresh tokens with reuse detection, service, router (`/accounts`, `/auth/*`, `/me`) | TASK-004 |
| `api/app/modules/profiles/` | Profile model (draft), `create_profile_for` | TASK-004 |
| `api/app/modules/profiles/nicks.py`, `service.py`, `router.py` | Nick rules (PRF-BR-2, mirrored in `client/src/lib/nick.ts`; shared test cases in `docs/api/nick-cases.json`), reserved nicks (`0004` seeds system and offensive words; offensive ones also block nicks containing them), suggestions, availability, suggestion and save (shared 120/min limit), `PUT /me/profile/nick`; `GET`/`PATCH /me/profile` with optimistic locking and E.164 phones | TASK-006 |
| `api/app/modules/accounts/confirmation.py` | E-mail confirmation tokens (48 h, single use, resend invalidates earlier ones), confirm and resend | TASK-005 |
| `api/app/modules/notifications/` | `send()` (queues after commit, never fails the caller), Celery task with retries, SMTP adapter, Jinja2 templates (HTML + text, Polish) | TASK-005 |
| `client/src/features/auth/ConfirmEmail*.tsx`, `client/src/app/potwierdz-email/` | Confirmation page (success, expired, logged-out redirect) and the panel banner with resend | TASK-005 |
| `client/src/app/` | Next.js App Router: `layout.tsx` (font, metadata, tokens, session provider), home, `/rejestracja`, `/logowanie`, `/panel` (guarded shell), `/regulamin`, `/prywatnosc` | TASK-001, TASK-004 |
| `client/src/lib/api/` | `schema.d.ts` generated from the contract (`npm run api:types`, checked by `api:check`), `client.ts` (openapi-fetch, in-memory access token, silent refresh) | TASK-004 |
| `client/src/lib/session.tsx`, `client/src/features/auth/` | Session context; registration and login forms (React Hook Form + Zod) | TASK-004 |
| `client/src/app/kreator/`, `client/src/features/wizard/`, `client/src/lib/useRequireSession.ts` | Wizard shell (stepper, „Dokończę później”), step 1 with live nick check and suggestion chips; session guard shared with `/panel` | TASK-006 |
| `api/app/modules/profiles/` (publishing) | `published_profiles` snapshot (`0005`, `PublishedProfileV1` = `ProfileContentOut`), `POST /me/profile/publish` and `/unpublish`, `GET /public/profiles/{nick}` (`Cache-Control: no-store`, one 404 for every hidden page) | TASK-007 |
| `client/src/app/user/[nick]/`, `client/src/features/public/`, `client/src/lib/publicProfile.ts` | Public page rendered on the server from `API_INTERNAL_URL` (no data cache, canonical-nick redirect), Classic layout; `app/not-found.tsx` + `components/NotFoundPage.tsx` shared 404 | TASK-007 |
| `client/src/features/panel/PublishPanel.tsx` | Panel: page status badge, „Opublikuj” / „Opublikuj zmiany” / „Ukryj stronę”, reasons why publishing is disabled | TASK-007 |
| `client/src/app/edytor/`, `client/src/features/editor/` | Editor: `useAutosave` (1 s debounce, only changed fields, optimistic `version`, invalid fields held back, conflict stops saving, unsaved changes kept in `localStorage` per account), form sections „O mnie” and „Kontakt”, save state and publish in the top bar, preview placeholder and phone tabs | TASK-008 |
| `client/src/lib/phone.ts` | Phone prefixes, E.164 → grouped display (`libphonenumber-js`), editor split and save value | TASK-008 |
| `api/app/modules/profiles/links.py`, `service.py` (links) | URL rules (http/https only, `https://` added, no spaces, other schemes or `user@`), service detection and default labels; `profile_links` (`0006`, position unique per profile and checked at commit), add / update / delete / reorder under the profile lock, each bumping the draft version; links are part of the published snapshot | TASK-009 |
| `client/src/features/editor/LinksSection.tsx`, `client/src/components/LinkIcon.tsx` | Links in the editor (empty state, inline form, `@dnd-kit` drag and drop with keyboard and Polish announcements, ↑/↓ on phones); link changes run through `useAutosave.exclusive` so they never race an autosave; service tiles shared with the public link cards | TASK-009 |
| `api/app/modules/media/` | Images: `processing.py` (Pillow: type from content, 24 Mpx limit, reduced decoding, sRGB, first frame, EXIF orientation applied, WebP variants without metadata), `storage.py` (fsspec, `MEDIA_URL`), `images` table (`0007`), `service.py` (`store_upload` with 30/h limit, `urls_for`, `prune`), `router.py` (`GET /media/{imageId}/{size}.webp`: owner or visible published page, same 404 otherwise; public one day / private no-store) | TASK-010 |
| `api/app/modules/profiles/` (images) | `PUT`/`DELETE /me/profile/images/{kind}` (request length checked before parsing), avatar/background on the draft and in the snapshot, unused images deleted once neither the draft nor the snapshot shows them | TASK-010 |
| `client/src/features/editor/ImagesSection.tsx`, `CropDialog.tsx`, `cropImage.ts`, `client/src/components/OwnerImage.tsx` | Photo (square crop with `react-easy-crop`, JPEG ≤ 1024 px from a canvas) and background uploads with progress (`uploadWithProgress`), errors, remove; draft images shown through `authorizedFetch` blob URLs; public page uses `srcset` | TASK-010 |
| `infra/` | Local Caddy config, PostgreSQL init (test database) | TASK-001 |
| `infra/server/` | Server bootstrap, staging/production Compose stack, Caddyfile with TLS and security headers, `deploy.sh` with rollback | TASK-003 |
| `.github/workflows/` | `ci.yml` (check, publish), `deploy-staging.yml` | TASK-002, TASK-003 |
