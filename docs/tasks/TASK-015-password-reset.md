---
id: TASK-015
title: Password reset
status: DONE
priority: high
iteration: ITER-04
depends_on: [TASK-005]
areas: [api, client]
materials:
  - docs/product/areas/accounts.md
  - docs/api/openapi.yaml
---

## Goal
An owner who forgot the password sets a new one through an e-mail link.

## Scope
- Endpoints `POST /auth/password-resets` and `/confirm`; 1-hour single-use token; all sessions revoked after reset; security notice e-mail.
- Client: "Nie pamiętam hasła" link on the login page and in the `email_taken` message, request page, new password page, expired link state.
- Rate limits per IP and per e-mail for reset requests.

## Out of scope
- Changing the login e-mail (Later).

## Scenarios

### Scenario 1: Reset
- When the owner requests a reset and opens the link within 1 hour, then they set a new password, are logged in and other sessions are revoked.

### Scenario 2: Unknown e-mail (negative)
- When an unknown e-mail is submitted, then the same 202 response and message are shown as for a known one, and no e-mail is sent.

### Scenario 3: Expired link (negative)
- When the link is older than 1 hour or used, then the page shows "Link wygasł" with a way to request a new one.

### Scenario 4: Too many requests (negative)
- When more than 5 reset requests come from one IP within an hour, then 429 with `Retry-After` is returned.

## Technical notes
High-risk change: security review.

## Report

**Done.** Approved after 2 security review rounds. `POST /auth/password-resets` always answers 202 with an empty body; the account lookup, the one-time token (1 hour, single use, a new request replaces earlier links) and the e-mail run in a background task after the response, so neither the answer nor its timing reveals whether the account exists. `POST /auth/password-resets/confirm` checks the token first (`410 token_expired` for used, expired, replaced or unknown links), then the password policy (`422` on `newPassword`, the link stays usable), sets the password, revokes every refresh token, marks the e-mail confirmed (the link proves the mailbox), logs this browser in (`200 Session` + refresh cookie, the contract said 204) and sends the security notice „Hasło do Profilo zostało zmienione”. Access tokens issued before the change are refused at once: `iat` now carries fractional seconds and is compared with `password_changed_at` (before, other browsers kept working up to 15 minutes). Client: „Nie pamiętam hasła” under the password on the login page and in the `email_taken` message, `/nie-pamietam-hasla` (request, same message for every address, „Wyślij jeszcze raz”), `/nowe-haslo` (new password with „Pokaż”, success with „Przejdź do panelu”, „Link wygasł” with „Wyślij nowy link”; `noindex`, `no-referrer`).

Acceptance criteria:
- S1 reset — met: E2E registers an owner through the API (a second session), requests the link in the UI, takes it from Mailpit, sets a new password, lands logged in in the panel; the other session's access token gets 401, the old password 401. API tests also check the revoked refresh token, the new password login and the notice e-mail.
- S2 unknown e-mail — met: identical 202 and empty body for a known and an unknown address, no e-mail for the unknown one (API test); the page shows the same message (E2E).
- S3 expired link — met: used, expired (> 1 h), replaced, unknown and confirmation-purpose tokens → 410 (API test); the page shows „Link wygasł” with „Wyślij nowy link” (E2E reuses the link; unit tests).
- S4 too many requests — met: the 6th request from one IP within an hour → 429 with `Retry-After` (API test). Extra requests for one address (more than 3 per hour) are dropped silently instead, so a 429 cannot tell anyone that the address was asked for.

Checks: api 343 tests, 99 %; client 393 tests, 95.8 % branches; contract 26 paths; E2E 8 tests pass locally. E-mails checked in Mailpit.

Decisions: the reset logs the browser in (scenario 1) and therefore returns a session, not 204; an unconfirmed e-mail becomes confirmed by the reset; the per-address limit drops silently. Known limit: a request already counted against the per-IP limit is still refused for an hour even if it was for one's own address (shared NAT); 5 per hour is the task's number.

Security review round 1 fixes: a refresh rotating at the moment of the reset kept a token the revocation could not see (READ COMMITTED) — login and refresh now lock the account `FOR SHARE` before touching refresh tokens and the reset holds it `FOR UPDATE`; a concurrency test (a refresh paused while holding its locks, the reset running meanwhile) fails without the fix; `password_changed_at` is taken after the password hash is computed; Caddy redacts `token` in its access log (also for `/potwierdz-email`); `/nowe-haslo` removes the token from the address bar and history after reading it; the per-IP limit counts an IPv6 /64 as one address and reset e-mails have a daily cap of 150 (quota shared with confirmations), counted only for existing accounts after the response, so made-up addresses cannot use it up; reaching it logs an error.
