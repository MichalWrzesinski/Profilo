---
id: TASK-016
title: Account settings: change password and delete account
status: READY
priority: high
iteration: ITER-04
depends_on: [TASK-015]
areas: [api, client]
materials:
  - docs/product/areas/accounts.md
  - docs/api/openapi.yaml
  - docs/design/design-system.html#modal
---

## Goal
The owner changes the password and can permanently delete the account with the profile.

## Scope
- `PUT /me/password` for confirmed accounts only (roles table in accounts.md; 403 `email_not_confirmed` otherwise), revokes other sessions, sends a security e-mail; `POST /me/deletion` with password: cascade delete, nick quarantine 30 days, media files deleted by a task, confirmation e-mail.
- Client: account settings page and the deletion dialog from the design system.

## Out of scope
- Data export (not planned).

## Scenarios

### Scenario 1: Change password
- When the owner enters the current and a valid new password, then the password changes and other sessions are logged out.

### Scenario 2: Delete account
- When the owner confirms deletion with the password, then the account, profile, links and images are gone, the public page returns 404 and the nick is reserved for 30 days.

### Scenario 3: Wrong password (negative)
- When the current password is wrong, then 403 `invalid_password` is shown and nothing changes.

### Scenario 4: Unconfirmed account (negative)
- When an owner with an unconfirmed e-mail tries to change the password, then 403 `email_not_confirmed` is returned and deletion of the account remains available.

## Technical notes
High-risk change (personal data deletion): security review.

## Report
Filled in by development after the task.
