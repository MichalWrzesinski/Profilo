---
id: TASK-019
title: Landing page and legal pages
status: IN_PROGRESS
priority: high
iteration: ITER-05
depends_on: [TASK-012]
areas: [client]
materials:
  - docs/design/mockups/final/screens.html#landing
  - docs/product/areas/public-page.md
  - docs/product/overview.md#constraints
---

## Goal
Visitors understand the product on the landing page, can start registration with a chosen address, and read the terms and privacy policy.

## Scope
- Landing per mockup with the "Zarezerwuj adres" field passing the nick to registration; example page in a phone frame.
- Pages `/regulamin` and `/prywatnosc` with drafts covering GDPR (data, purposes, retention incl. 30-day backups, processors: Hetzner, Brevo, Sentry), DSA notice-and-action, and operator placeholders.

## Out of scope
- Final legal wording and operator data — provided by the user before production.

## Scenarios

### Scenario 1: Start from landing
- When a visitor types "anna" and clicks "Zarezerwuj adres", then registration opens and wizard step 1 proposes "anna" if available.

### Scenario 2: Legal pages
- When the footer links are opened, then both pages render with the current operator placeholders clearly marked.

### Scenario 3: Taken address (negative)
- When the typed address is taken, then wizard step 1 shows it as taken with suggestions.

## Technical notes
Legal texts are drafts by the agent; the user reviews them before production (pre-deployment list).

## Report

**Implemented, in review.** The home page follows the mockup:
- hero, then „Zarezerwuj adres” with the real domain as the prefix;
- the example page in a phone frame, three feature cards and a footer with the legal links.

The address field is a plain GET form to `/rejestracja?adres=…`, so it works before hydration and without JavaScript. The registration page normalises the address, says it will be checked in the next step and passes it on to `/kreator?adres=…`. There, step 1 takes it instead of proposing one from the name and checks it at once. The phone frame shows `/przyklad`, the real public page component with made-up data (`noindex`, framable by the same origin; Caddyfile updated).

`/regulamin` and `/prywatnosc` are drafts with a „Wersja robocza” notice. Every operator value comes from `lib/operator.ts` and, while empty, is shown as a marked placeholder („[do uzupełnienia: …]”).
- **Privacy policy:** controller, data and purposes with legal bases, retention (7-day unconfirmed accounts, immediate deletion, 30-day backups, 30-day nick quarantine, IP 1 h and 14 days in logs), processors (Hetzner, Brevo, Sentry), rights incl. the complaint to PUODO, cookies (only `profilo_rt`).
- **Terms:** the service, the account, content rules, DSA notice-and-action (contents of a notice, confirmation, statement of reasons, appeal within 6 months, point of contact), liability, complaints, changes.

The top bar of these pages fits 320 px.

Acceptance criteria:
- S1 start from landing — met: the main-flow E2E now starts on the landing (example page visible in the frame), types „Ewa Testowa …”, clicks „Zarezerwuj adres”, registers and finds `ewa-testowa-…` in step 1, checked and free; unit tests for the page, the form and step 1.
- S2 legal pages — met: E2E opens both from the footer and sees the draft notice and the marked placeholders; axe (WCAG 2.1 AA) and no horizontal scroll at 320 and 1440 px for the home page and both legal pages.
- S3 taken address — met: step 1 shows „Ten adres jest już zajęty” with suggestions for an address from the landing (unit test); invalid addresses are marked at once.

Checks: client 437 tests, 95.8 % branches; E2E 17 tests pass locally; production build passes locally; Caddyfile validated.

Decisions: the claim form needs no JavaScript; the example is a real page in an iframe (shows the phone layout exactly as visitors see it) instead of a scaled copy; the legal texts are drafts by the development team — the operator data and the legal review are on the pre-production list in `plan.md`.

Review round 1 fixes: the legal drafts now match what the system does — Caddy keeps its access log (IP addresses) as a file rotated after 14 days (before, Docker kept it by size, possibly months), e-mail addresses in the 1-hour attempt counters are listed, Sentry is marked as planned with what must be confirmed, backups cover photos too and are marked as pending (TASK-022), abuse-report data (GDPR art. 14) and the operator's mailbox provider are covered; the terms add the DSA statement-of-reasons contents, no automated decisions, appeals for notifiers too, out-of-court bodies and courts, the users' point of contact and languages, and when a page or account can be blocked; promises that need manual operator work and the real abuse address are on the pre-production list. The example frame is `inert` (keyboard users could reach its links) and the E2E axe run now scans it loaded. The address from the landing is trimmed and loses trailing hyphens. The home page has a canonical URL and Open Graph tags. The sample phone number is fictional.
