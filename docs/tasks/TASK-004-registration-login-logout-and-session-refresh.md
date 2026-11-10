---
id: TASK-004
title: Registration, login, logout and session refresh
status: IN_PROGRESS
priority: highest
iteration: ITER-01
depends_on: [TASK-001]
areas: [api, client]
materials:
  - docs/product/areas/accounts.md
  - docs/api/openapi.yaml
  - docs/architecture.md#authentication
  - docs/design/mockups/final/screens.html#register
  - docs/design/mockups/final/screens.html#register-error
---

## Goal
A visitor creates an account with display name, e-mail and password, is logged in at once, and can log out and in again.

## Scope
- `accounts` module: tables accounts and refresh_tokens, Argon2id, common-password check, JWT access token and rotating refresh token cookie with reuse detection.
- Endpoints: `POST /api/v1/accounts`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /api/v1/me`.
- Empty profile created with the account (display name copied; layout `classic` and accent `granat` stored from the start, as in the snapshot schema).
- Placeholder pages `/regulamin` and `/prywatnosc` („Dokument w przygotowaniu”) linked from the registration form; full texts in TASK-019.
- Rate limits per IP and per e-mail (Valkey) for registration and login; progressive delay after failed logins.
- Client: registration and login pages, panel shell with top bar and menu (Wyloguj się), token refresh, redirect to the panel after registration (wizard step 1 is added by TASK-006).

## Out of scope
- E-mail confirmation (TASK-005).
- Password reset and its link in the `email_taken` message (TASK-015).
- ALTCHA challenge (TASK-018).
- Final legal texts (TASK-019).

## Scenarios

### Scenario 1: Successful registration
- When a visitor submits valid data and accepts the terms, then an account and an empty profile exist, the response sets the refresh cookie and the user lands in the panel.

### Scenario 2: E-mail case (ACC-BR-1)
- When `Anna@Example.pl` registers after `anna@example.pl`, then 409 `email_taken` is returned.
- When the owner logs in with the e-mail in different letter case, then login succeeds.

### Scenario 3: Login and logout
- When the owner logs in with correct credentials, then the panel opens.
- When the owner logs out, then the refresh token is revoked and `/api/v1/auth/refresh` returns 401.

### Scenario 4: Session refresh
- When the access token expires, then the client refreshes it silently and the user stays logged in for up to 30 days of activity.
- When a used refresh token is replayed, then the whole token family is revoked (reuse detection).

### Scenario 5: Invalid input (negative)
- When the password has fewer than 10 characters or is on the common list, then 422 with the field message from the mockup is shown.
- When the password is longer than 128 characters, then 422 is returned.
- When the e-mail is already registered, then 409 `email_taken` and the message with a link to login are shown.

### Scenario 6: Wrong credentials (negative)
- When the e-mail is unknown or the password is wrong, then the same 401 `invalid_credentials` response is returned.
- When the 6th failed login for an account happens within 15 minutes, then 429 with `Retry-After` is returned.

## Technical notes
High-risk change: security review per code-review standard.

## Report

**Done (pending review).** Registration, login, session refresh with rotation and reuse detection, logout and `GET /me` (backend), and registration/login pages, guarded panel shell with logout, legal placeholders (client).

Acceptance criteria:
- S1 registration — met: API test (account + profile `classic`/`granat`, cookie `HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=30 d`), browser: form → panel.
- S2 e-mail case — met: `Anna@Example.pl` after `anna@example.pl` → 409 `email_taken`; login with mixed case works (API test and browser).
- S3 login/logout — met: browser login → panel; after logout `/panel` redirects to login; API test: refresh after logout → 401; logout ends only the current session.
- S4 refresh — met: browser reload restores the session from the cookie; client retries a GET once after 401; API test: replayed refresh token revokes the family (also the newer token). Sessions slide: each refresh issues a new 30-day token.
- S5 invalid input — met: too short / too long / common password → 422 with the field message shown under the password field; `email_taken` shows the login link.
- S6 wrong credentials — met: identical 401 for unknown e-mail and wrong password (timing equalised with a dummy Argon2 verify); 6th failed login in 15 min → 429 with `Retry-After`.

Review round 1 fixes: a refresh token reused within 30 s (parallel tabs, response lost on reload) gets a sibling token instead of revoking the family — verified live (two parallel refreshes with one cookie → 200/200, both new tokens valid) and by tests; later reuse still revokes the family. Passwords are no longer whitespace-trimmed; Argon2 runs in a worker thread; the client refreshes the access token 60 s before expiry for any request; rate-limit outages are logged at error level; login password limited to 128 characters as in the contract.

Checks: api 60 tests, 99.5 %; client 44 tests, 100 % lines / 96 % branches; contract 7 paths; audits, gitleaks clean.

Decisions:
- Common-password list: the ~30 000 passwords bundled with `zxcvbn` instead of a separate 100 k file (no download, maintained package); architecture.md updated.
- Rate limits fail open when Valkey is down (logged) so a cache outage does not block login; limits: registration 10/h per IP and 5/h per e-mail, login 30/15 min per IP, 5 failed logins per account per 15 min. "Progressive delay" is implemented as this lockout.
- Missing/invalid `X-Requested-With` on refresh/logout returns 401 (contract lists no 403 there).
- Design-system classes are used directly (`docs/design/components.css` imported globally).
- Small product decisions (check on staging): login page subtitle „Wróć do edycji swojej strony.”; panel placeholder text; menu is a single „Menu” button with „Wyloguj się”.

Limitations: no E2E test yet (TASK-011); ALTCHA not in this task (TASK-018).
