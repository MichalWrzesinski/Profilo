---
id: TASK-023
title: Error and uptime monitoring
status: IN_PROGRESS
priority: high
iteration: ITER-05
depends_on: [TASK-003]
areas: [infra, api, client]
materials:
  - docs/standards/development/deployment.md#monitoring-i-alerty
  - AGENTS.md
---

## Goal
Errors in api, worker and client and unavailability of staging and production are reported and alerted.

## Scope
- Sentry SDK in api, worker and client (EU region, `send_default_pii` off, sensitive fields filtered), release = commit SHA, environment name; `deploy-staging` and `deploy-production` create the Sentry release and upload client source maps (not published on the server). No Sentry token in `ci.yml` (AGENTS.md).
- Better Stack Uptime monitors for `/ready` on staging and production with e-mail alerts on downtime; Sentry alert rule for error spikes; failed deployments alerted by GitHub Actions failure notifications of the deploy workflows (e-mail to the user).

## Out of scope
- Performance tracing and dashboards.

## Scenarios

### Scenario 1: Error reported
- When an unhandled exception occurs in the api, then it appears in Sentry with the release and environment and without personal data.

### Scenario 2: Downtime
- When `/ready` fails for 2 minutes, then an alert e-mail is sent.

### Scenario 3: No PII (negative)
- When an error happens during registration, then the Sentry event contains no e-mail, password or token.

## Technical notes
Needs from the user: Sentry and Better Stack accounts; keys as repository secrets used only by the deploy workflows; GitHub Actions failure e-mails enabled in the user notification settings.

## Report

**Implemented, waiting for the Sentry and Better Stack accounts.** Delivered:
- API and worker: `sentry-sdk` 2.73.0, `app/core/monitoring.py` — on only with `SENTRY_DSN`; release = `SENTRY_RELEASE` (the deployed commit), environment = `ENVIRONMENT`, tags `service` and `request_id`; `data_collection` without user data, bodies, frame variables or query data; `scrub_event` on every event (e-mails, JWTs, long tokens, phone numbers, secrets in query strings, sensitive keys, SQL parameters, password hashes, and the exact passwords of the current request — the `Password` type of every request model marks them); error-level structured log entries become events (`report_errors`), so fail-open situations are alerted; failed Celery tasks via the Celery integration.
- Browser: `@sentry/nextjs` 11.10.0 (`instrumentation-client.ts`), errors only (no sessions, tracing, replays, client reports), scrubbed in the browser, sent to the API's tunnel `POST /api/v1/monitoring/sentry` (CSP allows only our origin): error events only, scrubbed again, the server's release and environment, forwarded with the server's DSN; dropped without a DSN; 200 KB, 30 reports / 10 min per IP. The error page reports what its boundary catches.
- Next.js server: `instrumentation.ts` (`onRequestError`), same scrubbing, tag `client-server`.
- Source maps: `productionBrowserSourceMaps`; the client image build adds debug IDs (`sentry-cli sourcemaps inject`, no token) and moves the maps to `/opt/sourcemaps`, outside the served directory (verified: 0 maps served, 43 moved, 39 of 39 scripts with a debug ID).
- Deploy workflows: `SENTRY_DSN` delivered to `.env.monitoring` (read by the app containers and the client, nothing else); a separate *Sentry release* job (`infra/ci/sentry-release.sh`, `getsentry/sentry-cli` 3.8.1 pinned) creates the release, links the commit, uploads the source maps from the published client image and records the deployment; it holds the Sentry token and never reaches the server; production requires DSN and token, staging works without.
- Backups: heartbeat to Better Stack after each daily backup (`…/fail` after a failure), `PROD_BACKUP_HEARTBEAT_URL`.
- Runbook *Monitoring*: Sentry (EU, data scrubbing, alert rules for new issues and error spikes), Better Stack monitors and heartbeat, GitHub failure e-mails, test event; privacy policy: Sentry described as in use (EU region, what a report contains and what is removed).

Verified:
- Scenario 1 and 3 (API tests with the real SDK and an in-memory transport): an unhandled exception during registration — raised with the e-mail, the password and a JWT in its message, with `Authorization` and cookie headers — reaches Sentry once with the release, environment, `service=api` and the response's request id, and contains none of them. The first run found the password in the exception message (no pattern recognises an arbitrary password): fixed by marking request passwords as secrets.
- Error-level logs with and without exceptions become events, warnings do not; the worker reports with `service=worker`.
- Tunnel: an envelope serialised by `@sentry/core` 11.10 itself (fixture) is read correctly (an item without length, an attachment with length and a newline); only error events are forwarded, scrubbed, with the server's DSN and release; 413, 429, drop without DSN, forward failure logged as a warning (never an error, which would loop).
- Client: scrubber, server and browser initialisation (off without DSN / outside production; tunnel; sessions and tracing removed), error page reports. `make check` green (API 446 tests, client 454, coverage over 95 %); production images build.

Not verified: real Sentry ingestion and the *Sentry release* job (no Sentry account yet); Better Stack monitors and scenario 2 (no account; configuration in the runbook — with a 3-minute check interval on a plan the alert comes later than 2 minutes).

Needs from the user: Sentry (EU) and Better Stack accounts; `STAGING_SENTRY_DSN`, `STAGING_SENTRY_AUTH_TOKEN`, `PROD_SENTRY_DSN`, `PROD_SENTRY_AUTH_TOKEN`, variables `SENTRY_ORG`, `SENTRY_PROJECT`; Better Stack monitors and heartbeat (`PROD_BACKUP_HEARTBEAT_URL`); GitHub failure e-mails (runbook *Monitoring*).

Decisions:
- Browser reports go through the API instead of straight to Sentry: CSP stays `connect-src 'self'`, one image serves every environment (no DSN at build time), and the server scrubs once more and decides release and environment.
- One Sentry project for all services, environments separate; source maps by debug ID (no release string baked into the image).
- Error-level logs as events instead of stdlib logging events: one path, the structured log already marks what needs attention.
- New transitive dependencies of `@sentry/nextjs` published less than two weeks ago (`rollup` 4.68.3, `glob` 13.0.7, `brace-expansion` 5.0.13) are pinned to the previous releases via `overrides`.
