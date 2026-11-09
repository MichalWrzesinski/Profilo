# Technology summary (for approval)

Status: approved by the user on 2026-11-09 — Hetzner Cloud (CX33 production, CX23 staging, Storage Box backups), Brevo for e-mail, start budget ≈ €19/month + VAT. Prices checked 2026-11-09 from public sources; verify on the provider's page when ordering. EUR prices exclude VAT.

## Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.15, FastAPI, Pydantic 2, SQLAlchemy 2 (async), Alembic |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, CSS Modules + `docs/design/tokens.css` — one app for landing, public pages and panel ([ADR 0001](decisions/0001-single-nextjs-frontend.md)) |
| Database | PostgreSQL 18 |
| Jobs, rate limits | Celery 5 + Valkey 9 ([ADR 0003](decisions/0003-background-jobs-celery-valkey.md)) |
| Images | Pillow, stored on a server volume through fsspec (S3-ready) |
| Runtime | Docker Compose behind Caddy; Node.js 26 LTS for Next.js |
| Admin | No panel in v1 (brief); operator CLI for blocking pages |

## Architecture

Modular monolith: `accounts`, `profiles`, `media`, `notifications`, `qr`, `core` — see [architecture.md](architecture.md). Draft in tables, published version as an immutable snapshot ([ADR 0002](decisions/0002-draft-and-published-snapshot.md)). API contract: [api/openapi.yaml](api/openapi.yaml).

## External services

### Hosting (paid — needs approval)

| | Hetzner Cloud (recommended) | OVHcloud VPS | DigitalOcean Droplets |
|---|---|---|---|
| Company / data location | DE company; DE or FI data centres | FR company; FR, DE, PL (Warsaw) | US company; Frankfurt / Amsterdam |
| Production server | CX33 4 vCPU / 8 GB / 80 GB ≈ €9/mo incl. IPv4 | VPS 4 vCore / 8 GB ≈ €10–13/mo (verify) | 4 GB / 2 vCPU ≈ $24/mo |
| Staging server | CX23 2 vCPU / 4 GB ≈ €6/mo | ≈ €6–7/mo (verify) | 2 GB ≈ $12/mo |
| Off-site backups | Storage Box 1 TB ≈ €4/mo (other location) | Backup Storage add-on | Spaces $5/mo |
| GDPR | EU only, DPA in console | EU only, DPA | DPA + SCC; US parent company |
| Notes | Best price/performance; prices rose twice in 2026; some CX types temporarily limited — fall back to CPX/CAX if unavailable | Polish data centre, slightly higher price | Best docs/UX, highest price |

### Transactional e-mail (free tier first)

Volume estimate: confirmation + reset + notices ≈ 2–3 e-mails per new user; < 3 000/month at start.

| | Brevo (recommended) | Amazon SES (eu-central-1) | Postmark |
|---|---|---|---|
| Price at start | Free: 300 e-mails/day | ≈ $0.10–0.16 per 1 000 | from $15/mo (10 000) |
| Price at growth (≈ 20 000/mo) | ≈ $9–15/mo | ≈ $2–3/mo | $15/mo |
| Data location / GDPR | FR company, EU processing | EU region; US parent company | US company, DPA + SCC |
| Sandbox / testing | Yes (test mode, webhooks) | Sandbox until production access approved | Sandbox server |
| Integration | SMTP or REST API, official SDK | SMTP or API, more setup (DNS, IAM, bounce handling) | Excellent API, best deliverability |

All three work through one `notifications` adapter (SMTP), so switching later is a configuration change. Locally Mailpit captures e-mails.

### Free services

| Need | Service | Cost |
|---|---|---|
| Error monitoring | Sentry, Developer plan (EU data region) | €0 at start; Team ≈ $26/mo later |
| Uptime monitoring | Better Stack Uptime, free plan (or UptimeRobot free) | €0 |
| Bot protection on registration | ALTCHA (open source, self-hosted, no third party) | €0 |
| TLS | Let's Encrypt via Caddy | €0 |

### Domain

`profilo.pl` (or another name you choose) — availability not checked; typically ≈ 50–150 PLN/year for `.pl`, renewal prices vary by registrar.

## Monthly cost estimate

| Item | Start | Growth (≈ 5 000–10 000 owners) |
|---|---|---|
| Production server | €9 (CX33) | €15–17 (CX43, 8 vCPU / 16 GB) |
| Staging server | €6 (CX23) | €6 |
| Backups (Storage Box) | €4 | €4 |
| E-mail | €0 (Brevo free) | ≈ €9–14 (Brevo Starter) |
| Sentry | €0 | ≈ €24 (Team) |
| Uptime monitor | €0 | €0 |
| **Total / month** | **≈ €19 + VAT** | **≈ €58–65 + VAT** |
| Domain / year | ≈ 50–150 PLN | same |

## Decisions needed from the user

1. Hosting provider (recommended: Hetzner Cloud, production + staging + Storage Box ≈ €19/mo).
2. E-mail provider (recommended: Brevo, free tier to start).
3. Domain name to register (product name „Profilo”; `profilo.pl` availability to be checked).
