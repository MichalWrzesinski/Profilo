# 0004. Hosting on one EU VPS per environment with Docker Compose

Status: accepted — provider and costs approved by the user (2026-11-09)

## Context

Version 1 has low traffic (personal pages, small owner panel). The app must stay portable to any container host (devops standard). Personal data of EU users must be processed in the EU.

## Decision

- Production: one VPS (recommended: Hetzner Cloud CX33, 4 vCPU / 8 GB, Germany or Finland) running Docker Compose: Caddy (TLS, reverse proxy), `client` (Next.js), `api` (FastAPI), `worker` + `beat` (Celery), PostgreSQL 18, Valkey.
- Staging: a second, smaller VPS (CX23) with the same Compose file and its own secrets and data.
- Same origin: Caddy routes `/api/*` and `/media/*` to the API and everything else to Next.js, so the refresh-token cookie is first-party and CORS is not needed.
- User images: on a persistent volume through a storage abstraction (fsspec); switch to S3-compatible object storage when running more than one server.
- Backups: daily encrypted dumps of PostgreSQL and the media volume to an off-site Storage Box (different location), 30 days retention, monthly automated restore test.

## Consequences

- Lowest cost and full control; no vendor-specific services in code.
- Single-server production: an outage of the VPS is an outage of the service (acceptable for v1; restore time documented in the runbook).
- Scaling path: managed PostgreSQL + object storage + more app servers without code changes.
