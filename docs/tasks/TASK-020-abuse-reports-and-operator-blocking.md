---
id: TASK-020
title: Abuse reports and operator blocking
status: DONE
priority: medium
iteration: ITER-05
depends_on: [TASK-007]
areas: [api, client]
materials:
  - docs/product/areas/public-page.md
  - docs/architecture.md
---

## Goal
Anyone can report a page by e-mail, and the operator can block and unblock a page with a CLI command.

## Scope
- "Zgłoś nadużycie" mailto with the page URL in the subject (operator address from settings).
- CLI `profilo block-profile <nick>` / `unblock-profile <nick>` in the api image; blocked pages return 404; panel notice "Strona zablokowana — skontaktuj się z nami"; publish returns 403 `profile_blocked`.

## Out of scope
- Admin panel (out of scope of v1).

## Scenarios

### Scenario 1: Block
- When the operator blocks a nick, then the public page returns 404 immediately and the owner sees the notice.

### Scenario 2: Unblock
- When the operator unblocks it, then the last published version is visible again.

### Scenario 3: Blocked owner (negative)
- When the owner of a blocked page tries to publish, then 403 `profile_blocked` is returned.

## Report

**Done.** Approved after 2 security review rounds. Operator CLI in the api image: `profilo block-profile <nick>` and `profilo unblock-profile <nick>` (`app/cli.py`, a `/usr/local/bin/profilo` wrapper in every image stage; on a server `dc exec api profilo …`). Blocking sets `profiles.blocked_at` under a row lock and drops the cached preview cards; unblocking clears it. Both are idempotent and answer in Polish; an unknown nick is an error (exit 1). Blocking already had its effects in the read paths from TASK-007/010/013/014: the public page, its card and its images return the same 404 as an unknown page, the sitemap leaves it out, publishing returns 403 `profile_blocked`, the QR code 409. The owner now also sees „Strona zablokowana — skontaktuj się z nami” with a link to the appeal rules, in the panel and in the editor. „Zgłoś nadużycie” sends a `mailto:` with the page address in the subject to `ABUSE_EMAIL` (client setting read per request; empty shows the placeholder, also in the terms); the local, server compose and bootstrap `.env` pass it.

Acceptance criteria:
- S1 block — met: API test (public page and card 404 at once, cached card gone, owner status `blocked`); live: `dc exec api profilo block-profile blokada-test` → 404 at once, a second call says it was already blocked; the owner sees the notice in the panel (browser).
- S2 unblock — met: API test (the last published version is shown, the draft edited during the block stays a draft); live: 200 again.
- S3 blocked owner — met: publish → 403 `profile_blocked` (API test).

Checks: api 424 tests, 99 %; client 446 tests; contract unchanged; E2E unchanged (17).

Found while verifying live: the CLI failed on the server-like run although its tests passed — a standalone process had imported only the profiles models, so SQLAlchemy could not resolve the foreign key to `accounts` on flush. `app/models.py` now registers every model and the CLI and the Celery worker import it; a new test runs the CLI in a separate process and fails without the fix.

Decisions: no statement of reasons is sent automatically (it needs a human-written reason; the runbook and the pre-production list say the operator e-mails it); the abuse address is a setting rather than a constant, so the same image serves every environment.

Review round 1 fixes: the editor preview (`/podglad`, now a server page around the client frame) reads the same `ABUSE_EMAIL` as the public page, so preview and page stay identical when it is set (the E2E compares them); the placeholder is a non-deliverable `naduzycia@profilo.invalid` and a malformed `ABUSE_EMAIL` (e.g. with `?bcc=`) is ignored; deleting the account of a blocked page reserves its nick for good (migration `0008`, reason `blocked`) instead of releasing it after the 30-day quarantine; the runbook applies `ABUSE_EMAIL` with `dc up -d client`, mentions the preview card cache and how to free a blocked nick; the CLI works from any directory, normalises the nick it prints and exits 3 with one line when the database or Valkey is unreachable (other errors keep their traceback); the notice is a status, not an alert; env stubs reset in `afterEach`.
