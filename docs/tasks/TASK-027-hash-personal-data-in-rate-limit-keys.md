---
id: TASK-027
title: Hash personal data in rate-limit keys
status: PROPOSED
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
Filled in by development after the task.
