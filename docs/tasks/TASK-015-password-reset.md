---
id: TASK-015
title: Password reset
status: READY
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
- Client: "Nie pamiętam hasła" link, request page, new password page, expired link state.

## Out of scope
- Changing the login e-mail (Later).

## Scenarios

### Scenario 1: Reset
- When the owner requests a reset and opens the link within 1 hour, then they set a new password, are logged in and other sessions are revoked.

### Scenario 2: Unknown e-mail (negative)
- When an unknown e-mail is submitted, then the same 202 response and message are shown as for a known one, and no e-mail is sent.

### Scenario 3: Expired link (negative)
- When the link is older than 1 hour or used, then the page shows "Link wygasł" with a way to request a new one.

## Technical notes
High-risk change: security review.

## Report
Filled in by development after the task.
