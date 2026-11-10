---
id: TASK-005
title: E-mail confirmation and transactional e-mail
status: DONE
priority: highest
iteration: ITER-01
depends_on: [TASK-004]
areas: [api, client]
materials:
  - docs/product/areas/accounts.md
  - docs/api/openapi.yaml
  - docs/decisions/0005-transactional-email-brevo.md
  - docs/design/mockups/final/screens.html#wizard-nick
---

## Goal
The owner confirms the e-mail address with a link, which unlocks publishing.

## Scope
- `notifications` module: SMTP adapter, Celery task with retries and backoff, Polish HTML + text templates in the brand style (confirmation, already-registered notice not needed).
- `one_time_tokens` table; endpoints `POST /auth/email-confirmations` (resend) and `/confirm`.
- Confirmation e-mail sent after registration; client page `/potwierdz-email?token=…` with success and expired states; warning banner in the panel with "Wyślij ponownie".
- Mailpit locally; Brevo SMTP settings for staging from environment.

## Out of scope
- Password reset e-mails (TASK-015).

## Scenarios

### Scenario 1: Confirm
- When the owner opens a valid link within 48 hours, then the account is confirmed and the banner disappears.

### Scenario 2: Resend
- When the owner clicks "Wyślij ponownie", then a new e-mail is sent and previous links stop working.
- When resend is clicked twice within a minute, then the second request returns 429.

### Scenario 3: Logged out
- When the link is opened while logged out, then the e-mail is confirmed and the login page shows „Adres potwierdzony — zaloguj się”.

### Scenario 4: Expired or used link (negative)
- When the link is older than 48 hours or already used, then the page shows "Link wygasł" with a button to send a new one.

### Scenario 5: Provider down (negative)
- When the SMTP provider fails, then registration still succeeds, the task retries with backoff and the failure after the last retry is logged as error.

## Report

**Done.** Approved after 2 review rounds (security pass included). Confirmation e-mail queued after registration (after the commit), `POST /auth/email-confirmations` (resend, 1/min) and `/confirm`, `one_time_tokens` (hash only, 48 h, single use, resend invalidates earlier links), `notifications` module (Jinja2 HTML + text templates in Polish, SMTP adapter, Celery task with exponential backoff), client page `/potwierdz-email`, panel banner with „Wyślij ponownie”, login notice after confirming while logged out. Staging: SMTP credentials delivered by `deploy-staging` to `/srv/profilo/.env.secrets` (new secrets in the runbook).

Acceptance criteria (verified live with Mailpit and in the browser, and by tests):
- S1 confirm — met: link from the received e-mail confirmed the account, the banner disappeared; clicking the same link again still shows success.
- S2 resend — met: new link invalidates the previous one, second resend within a minute → 429 (API tests; banner states in client tests).
- S3 logged out — met: after logout the link confirmed the account and redirected to `/logowanie?potwierdzono=1` with „Adres potwierdzony — zaloguj się.”.
- S4 expired/used — met: unknown or expired token → „Link wygasł albo został już użyty.” with „Wyślij nowy link” (asks to log in first when logged out).
- S5 provider down — met: with Mailpit stopped, registration returned 201, the task retried with growing delays and delivered the e-mail ~15 s after Mailpit came back; after the last retry `email_failed` is logged at error level (test).

Review round 1 fixes: the client sent no access token to `/api/v1/auth/email-confirmations` (all `/auth/*` were exempt) — only the four token endpoints are exempt now, verified in the browser (resend 202, second click „Nowy link możesz wysłać za minutę.”, two e-mails in Mailpit); SMTP errors are classified (4xx/connection retried, 5xx/authentication fail at once) and logged with the SMTP code only — no recipient address in Celery logs; resend limited per account (1/min, 5/h) and per IP (20/h), confirm per IP (30/15 min); `/potwierdz-email` handles 409/429 after „Wyślij nowy link” and reads the session's own account from `/me`; `Date` header and sender-domain `Message-ID`; failed-job handling recorded in ADR 0003.

Checks: api 86 tests, 99.5 %; client 62 tests, 100 % lines; contract 9 paths.

Found and fixed during live verification:
- Celery redirected worker stdout, wrapping our JSON logs into another record at warning level — `email_failed` would not have alerted; `worker_redirect_stdouts=False`.
- The retry window (~25 s) was too short for a real outage — now up to ~8 min (9 retries, backoff capped at 10 min).
- An import error in the e-mail path would have turned a committed registration into a 500 — the import is now inside the guarded enqueue.

Decisions: e-mail sending is at-least-once (a retry after a lost SMTP response can send a duplicate); confirmation page sets `Referrer-Policy: no-referrer` so the token does not leak. Small product decisions (check on staging): banner texts after resend („Wysłaliśmy nowy link. Poprzednie linki już nie działają.”, „Nowy link możesz wysłać za minutę.”), e-mail copy.

Open minor points: TLS certificate errors are treated as transient (retried up to ~8 min); rate-limit keys contain plain e-mail addresses (TASK-027).

Limitations: Brevo itself not tested (no account yet); staging delivery waits for TASK-003 access and the new secrets.
