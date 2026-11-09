---
id: TASK-018
title: Registration bot protection (ALTCHA)
status: READY
priority: medium
iteration: ITER-04
depends_on: [TASK-004]
areas: [api, client]
materials:
  - docs/product/areas/accounts.md
  - docs/architecture.md#higher-risk-flows
  - docs/api/openapi.yaml
---

## Goal
Mass registration attempts from one IP must solve a proof-of-work challenge.

## Scope
- After 3 registrations per IP per hour, `POST /accounts` returns 428 with an ALTCHA challenge; the client solves it in a web worker and resubmits.
- Security events logged without personal data.

## Out of scope
- Third-party CAPTCHA services.

## Scenarios

### Scenario 1: Normal user
- When a visitor registers for the first time from an IP, then no challenge is shown.

### Scenario 2: Many attempts (negative)
- When the 4th registration from the same IP within an hour is submitted without a solution, then 428 is returned and the client solves the challenge before retrying.
- When a forged solution is submitted, then registration is rejected.

## Report
Filled in by development after the task.
