---
id: TASK-016
title: Account settings: change password and delete account
status: DONE
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

**Done.** Approved after 2 security review rounds. `PUT /me/password` (confirmed accounts only, `403 email_not_confirmed` checked first; `403 invalid_password` for a wrong current password; `422` on `newPassword` for the policy and for reusing the current password) sets the password, ends every session through the same helper as the reset (`accounts/sessions.py`: `password_changed_at` + all refresh tokens revoked, under the account `FOR UPDATE`), gives this browser a new session (`200 Session`, the contract said 204 — the old access token is refused after the change) and sends the security notice. `POST /me/deletion` checks the password, quarantines the nick for 30 days (upsert that never weakens a system or offensive reservation), deletes the account (profile, links, snapshot, image rows, tokens by `ON DELETE CASCADE`), clears the refresh cookie, then queues `media.delete_account_files` (removes the account's storage prefix, idempotent, accepts only a UUID) and the „Twoje konto w Profilo zostało usunięte” e-mail. Both endpoints share a limit of 5 wrong passwords per account per 15 minutes (429). Client: „Ustawienia konta” in the panel menu (`/panel/konto`) with „Zmień hasło” (hint instead of the form for an unconfirmed e-mail) and the danger zone with the deletion dialog from the design system (the page address in the text, password, „Anuluj” / „Usuń konto”), then `/konto-usuniete`, which signs out locally. `ShareDialog` and the deletion dialog share a new `Modal` component (focus trap, Escape, click outside, focus return).

Acceptance criteria:
- S1 change password — met: E2E logs in, changes the password in the settings; the other session's access token gets 401. API tests: the other refresh token is refused, the old password fails, the new one works, the notice e-mail is queued, this browser keeps working with the new session.
- S2 delete account — met: E2E publishes a page, deletes the account in the dialog, lands on „Konto usunięte”; the public page returns 404, login fails, another owner cannot take the nick (409), the e-mail arrives in Mailpit; the worker log shows `account_files_deleted`. API test: no rows left in accounts, profiles, links, snapshots, images, tokens; image URL 404; quarantine about 30 days.
- S3 wrong password — met: 403 `invalid_password` for the change (API) and for deletion (API and E2E: the page still answers 200).
- S4 unconfirmed — met: change → 403 `email_not_confirmed`, deletion → 204 (API tests); the UI shows a hint instead of the form.

Checks: api 365 tests, 99 %; client 411 tests, 95.9 % branches; contract 28 paths; E2E 9 tests pass locally.

Decisions: the change returns a new session (like the reset) instead of 204; the nick is quarantined whenever the account had one (ACC-BR-10 has no condition), the automatic deletion of unconfirmed accounts (TASK-017) releases it instead (ACC-BR-6); reusing the current password is refused; the goodbye page signs out (signing out in the panel raced with the panel's guard, which sent the browser to the login page — found by E2E); if the file task cannot be queued the files are removed directly in the request.

Security review round 1 fixes: cached Open Graph cards of the deleted profile are dropped from Valkey (they hold the name and photo); files are removed directly when the queue is down; confirmation and reset links lock the account before their token (the same order as deletion — before, a link clicked during a deletion could deadlock into a 500); the deletion dialog cannot be sent twice; `/konto-usuniete` signs out only after a real deletion (a one-shot flag), otherwise it goes home; a password change also cancels open reset links; the fail-open password limit is noted in the higher-risk flows table. Round 2 nits: the dialog's double-submit guard is a ref, and the token in memory and the local drafts are cleared right after the deletion too (in case the flag cannot be stored).
