---
id: TASK-024
title: CSP nonces instead of 'unsafe-inline' scripts
status: PROPOSED
priority: medium
iteration: ITER-05
depends_on: [TASK-003]
areas: [client, infra]
materials:
  - infra/server/Caddyfile
  - docs/standards/development/security.md
---

## Goal
The Content-Security-Policy no longer allows inline scripts, so injected script tags cannot run.

## Scope
- Next.js middleware issuing a per-request nonce and setting the CSP header with `'nonce-…'` and `'strict-dynamic'` for scripts.
- Remove `'unsafe-inline'` from `script-src` in the Caddyfile (Caddy keeps the other headers).

## Out of scope
- Styles (`style-src 'unsafe-inline'` stays until components no longer need inline styles).

## Scenarios

### Scenario 1: Pages work under the strict policy
- When any page is loaded on staging, then there are no CSP violations in the browser console and the page is interactive.

### Scenario 2: Injected script is blocked (negative)
- When an inline `<script>` without the nonce is present in the HTML, then the browser does not execute it.

## Technical notes
Proposed by TASK-003 (review): the current CSP allows `'unsafe-inline'` scripts because Next.js injects inline scripts.

## Report
Filled in by development after the task.
