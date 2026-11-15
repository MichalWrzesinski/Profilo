---
id: TASK-018
title: Registration bot protection (ALTCHA)
status: DONE
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

**Done.** Approved after 2 security review rounds. From the 4th registration attempt per IP within an hour (failed ones such as 409 `email_taken` count too, they are what address checking looks like) `POST /accounts` needs a solved proof-of-work challenge: without one, or with a forged, expired or reused one, it answers 428 `challenge_required` with a new challenge. The challenge uses the ALTCHA format (`algorithm`, `challenge` = SHA-256(salt + secret number), `maxnumber` 500 000, `salt` with `?expires=` 10 minutes, HMAC `signature`), implemented in `app/core/proof_of_work.py` without a library; the signing key is derived from the JWT secret, a solution is accepted once (Valkey, fails open like the rate limits). The registration form solves it in a web worker with a synchronous plain-JS SHA-256 (faster than one `crypto.subtle` promise per number, and available without a secure context; a worker failure answers null and the form shows a message), showing „Sprawdzamy, czy nie jesteś automatem…” in a live region, then sends the form again. Security events (`registration_challenge_required`, `proof_of_work_rejected` with the reason) are logged without IP or e-mail.

Acceptance criteria:
- S1 normal user — met: the first 3 registrations from an IP get 201 without a challenge (API test); a person registering in the browser sees nothing.
- S2 many attempts — met: the 4th attempt without a solution → 428 with a challenge; with the solution → 201 (API test); twelve kinds of forged solutions (wrong number, signature, algorithm, types, missing or bad expiry, broken base64/JSON), an expired challenge, one signed with another key and a reused solution are all refused (API tests). E2E: attempts from one IP until 428, a forged solution refused, then a person registers in the browser, which solves the challenge in its worker and lands in the wizard.

Checks: api 413 tests, 99 %; client 426 tests, 95.9 % branches; contract 28 paths; E2E 10 tests pass locally.

Decisions: no ALTCHA libraries (the format is a few dozen lines on both sides and new dependencies need two weeks of age); the threshold counts attempts, not only successful registrations; the per-IP limit stays at 10 per hour (it is the hard stop: native code solves a challenge in milliseconds, the proof of work only adds cost).

Security review round 1 fixes: (blocker) the threshold was read before the counter was increased, so parallel requests all saw a low count and skipped the challenge — now a separate attempt counter is increased atomically first and the decision is made on its result (concurrency test: of 8 parallel attempts exactly 3 pass without a challenge); the expiry could be extended by moving digits from the number into the salt (no separator in the hash input) — the salt must now match exactly what the server makes and cannot expire more than 10 minutes ahead, the single-use key never lives longer than that; IPv6 addresses count per /64 for registration and login too (shared `rate_limit.ip_subject`, before only the reset did); `maxnumber` raised from 200 000 to 500 000 and the solver hashes synchronously; the per-IP limit back to 10 (it was raised to 20 in the first version). Round 2 nits: an IPv4-mapped IPv6 address counts as its IPv4 address; the key-clearing command in AGENTS.md fixed.

After review: CI's `check` job hit its 30-minute limit while building the client production image — `next build` looped forever because the module creating the web worker was imported by the worker itself (the dev server and E2E were fine). The solver now lives in `proofOfWorkSolver.ts`, which neither creates nor imports the worker; the production build takes about 12 s again locally.
