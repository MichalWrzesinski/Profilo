# 0003. Background jobs with Celery on Valkey

Status: accepted (2026-11-09)

## Context

Profilo needs background work: sending e-mails (confirmation, reset, security notices), image processing (resize, EXIF removal), and periodic jobs (delete unconfirmed accounts after 7 days — ACC-BR-6, release nicks after 30-day quarantine — ACC-BR-10, delete orphaned images). Rate limiting (ACC limits) also needs a shared fast store. Options: Celery, Dramatiq, arq, a PostgreSQL-backed queue (Procrastinate).

## Decision

Use Celery 5 with Valkey as broker and result-less mode, Celery Beat for periodic jobs (single instance, idempotent tasks with a lock). Valkey is also used for rate limiting. E-mail tasks are enqueued after commit; a lost enqueue is recoverable by the user ("Wyślij ponownie"), so no outbox table in v1.

## Consequences

- Most widely used Python task queue; mature retries, dead-letter via a failed-task log, good monitoring.
- One extra container (Valkey) — also needed for rate limiting anyway.
- Tasks are synchronous Python functions; the API is async FastAPI. Shared code lives in module services usable from both.
