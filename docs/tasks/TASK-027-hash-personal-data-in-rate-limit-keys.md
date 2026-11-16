---
id: TASK-027
title: Hash personal data in rate-limit keys
status: DONE
priority: low
iteration: ITER-04
depends_on: []
areas: [api]
materials:
  - api/app/core/rate_limit.py
  - docs/standards/development/security.md
  - docs/architecture.md
---

## Goal
Valkey rate-limit keys no longer contain e-mail or IP addresses in plain text.

## Scope
- Key subjects (e-mail, IP) stored as a keyed hash (HMAC-SHA-256 with a server secret) in `rate_limit`.
- Existing keys simply expire (TTL ≤ 1 h).

## Out of scope
- Other Valkey data.

## Scenarios

### Scenario 1: Limits still work
- When the 6th failed login for an account happens within 15 minutes, then 429 is returned as before.

### Scenario 2: No plain addresses (negative)
- When Valkey keys are listed after login attempts, then no key contains an e-mail or IP address.

## Technical notes
Proposed by the TASK-005 review (2026-11-10): `rl:register_email:<address>` and `rl:login_fail:<address>` keys hold addresses for up to 1 h.

## Report

**Done.** `core/rate_limit.py`: every counter key is `rl:<limit>:<hash>`, the hash being the first 128 bits of HMAC-SHA-256 of the subject with a key derived from the server secret (`JWT_SECRET`, label `profilo:rate-limit`, like the proof-of-work key). All subjects are hashed (e-mail and IP addresses, and for one rule also account ids); `counter_key()` is the only place that builds a key. Existing plain keys expire by themselves (windows of at most 1 h, except the daily cap on reset mails, which counts a constant subject).

Verified (API tests, 454): scenario 1 — the existing test of the sixth failed login within 15 minutes still gets 429 and `Retry-After`, and every other limit test passes unchanged; scenario 2 — after failed logins, a registration and a reset request, no Valkey key contains `@`, the address or the client IP, and every key ends in a 32-character hex hash; the hash is stable for a subject, differs between subjects and changes with the server secret.

Decision: a keyed hash instead of a plain SHA-256 — the set of e-mail addresses and IPv4 addresses is small enough to guess, so an unkeyed hash of a listed key could be reversed by trying candidates.
