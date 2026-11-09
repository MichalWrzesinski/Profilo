---
id: TASK-005
title: E-mail confirmation and transactional e-mail
status: READY
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
Filled in by development after the task.
