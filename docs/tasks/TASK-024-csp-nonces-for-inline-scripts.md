---
id: TASK-024
title: CSP nonces instead of 'unsafe-inline' scripts
status: IN_PROGRESS
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

**Done locally; staging check after the merge.** Delivered:
- `client/src/proxy.ts` (Next.js 16 Proxy): a 16-byte random nonce per page request, set on the request (Next.js reads it and puts it on its own scripts) and in the response's `Content-Security-Policy`; not for the API, media, Next.js assets and files, nor for prefetches.
- `client/src/lib/csp.ts`: `script-src 'nonce-…' 'strict-dynamic'` (plus `'unsafe-eval'` only in development, for React's debug stacks), `worker-src 'self'` (`'strict-dynamic'` makes browsers ignore `'self'` for scripts, and the registration proof-of-work runs in a web worker), `style-src 'self' 'unsafe-inline'` without a nonce (a nonce there would disable `'unsafe-inline'` for the inline styles — out of scope), `frame-ancestors 'self'` only for `/podglad` and `/przyklad` (moved from Caddy).
- Root layout: `await connection()` — every page renders per request (HTML generated at build time cannot carry a nonce). Most pages were dynamic already (`force-dynamic`).
- `infra/server/Caddyfile`: the two CSP variants replaced by one strict fallback (`?Content-Security-Policy`, only where the response has none: API, media, assets), without `'unsafe-inline'` for scripts.

Verified:
- Unit: the policy (no `'unsafe-inline'` for scripts, eval only in development, framing per path, `worker-src`, styles), nonces random and unique, proxy sets request and response headers, matcher covers pages and skips API, media, assets and files.
- E2E (`e2e/tests/csp.spec.ts`, local stack): scenario 1 — `/`, `/przyklad`, `/rejestracja`, `/logowanie`, `/nie-pamietam-hasla`, `/regulamin` hydrate with no CSP violation and a nonce policy; every request gets a new nonce; scenario 2 — an inline `<script>` injected into the HTML does not run and is reported as a `script-src` violation. The whole suite passes under the policy, including registration with the proof-of-work worker and the editor preview iframe.
- Production image: no `'unsafe-eval'`, all 22 scripts of a page carry the nonce, files such as `robots.txt` get no page policy.

Decisions:
- The CSP moved from Caddy to the app for pages (a nonce exists only per render); Caddy keeps a strict fallback, so nothing is served without a policy.
- All pages dynamic instead of mixing static pages with a weaker policy.
