---
id: TASK-004
title: Registration, login, logout and session refresh
status: READY
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
- Empty profile created with the account (display name copied, layout split, accent granat).
- Rate limits per IP and per e-mail (Valkey) for registration and login; progressive delay after failed logins.
- Client: registration and login pages, panel shell with top bar and menu (Wyloguj się), token refresh, redirect to wizard step 1 after registration.

## Out of scope
- E-mail confirmation (TASK-005).
- Password reset (TASK-015).
- ALTCHA challenge (TASK-018).

## Scenarios

### Scenario 1: Successful registration
- When a visitor submits valid data and accepts the terms, then an account and an empty profile exist, the response sets the refresh cookie and the user lands on wizard step 1.

### Scenario 2: Login and logout
- When the owner logs in with correct credentials, then the panel opens.
- When the owner logs out, then the refresh token is revoked and `/api/v1/auth/refresh` returns 401.

### Scenario 3: Session refresh
- When the access token expires, then the client refreshes it silently and the user stays logged in for up to 30 days of activity.
- When a used refresh token is replayed, then the whole token family is revoked (reuse detection).

### Scenario 4: Invalid input (negative)
- When the password has fewer than 10 characters or is on the common list, then 422 with the field message from the mockup is shown.
- When the e-mail is already registered, then 409 `email_taken` and the message with links to login and reset are shown.

### Scenario 5: Wrong credentials (negative)
- When the e-mail is unknown or the password is wrong, then the same 401 `invalid_credentials` response is returned.
- When the 6th failed login for an account happens within 15 minutes, then 429 with `Retry-After` is returned.

## Technical notes
High-risk change: security review per code-review standard.

## Report
Filled in by development after the task.
