---
id: TASK-007
title: Publish, unpublish and the minimal public page
status: DONE
priority: highest
iteration: ITER-01
depends_on: [TASK-005, TASK-006]
areas: [api, client]
materials:
  - docs/product/areas/profile.md
  - docs/product/areas/public-page.md
  - docs/decisions/0002-draft-and-published-snapshot.md
  - docs/api/openapi.yaml
  - docs/design/mockups/final/screens.html#public-minimal
  - docs/design/mockups/final/screens.html#public-404
---

## Goal
The owner publishes the page and visitors see it at `/user/{nick}`; unpublishing hides it immediately.

## Scope
- `published_profiles` snapshot (schema PublishedProfileV1), `POST /me/profile/publish` and `/unpublish`, `GET /public/profiles/{nick}`, nick lock after first publication.
- Public page `/user/{nick}` rendered on the server with the Classic layout in the fixed content order (PUB-BR-4): initials avatar, display name, headline, „Napisz e-mail” button (`mailto:`) when a public e-mail is set; footer with "Utworzono w Profilo" and "Zgłoś nadużycie" (mailto placeholder).
- Shared 404 page for unknown, unpublished and blocked nicks.
- Panel: status badge, "Opublikuj" / "Opublikuj zmiany" / "Ukryj stronę" actions; publish disabled until e-mail confirmed.

## Out of scope
- Other layouts and colours (TASK-012).
- SEO and Open Graph (TASK-013).
- Published screen with QR (TASK-014).

## Scenarios

### Scenario 1: First publication
- When a confirmed owner with a nick publishes, then `/user/{nick}` shows the page and the nick can no longer be changed.

### Scenario 2: Publish changes
- When the owner changes the draft, then visitors still see the previous version until "Opublikuj zmiany".

### Scenario 3: Unpublish
- When the owner hides the page, then `/user/{nick}` returns the 404 page on the next request; publishing again shows the current draft.

### Scenario 4: Without JavaScript
- When the public page is opened with JavaScript disabled, then the content and the „Napisz e-mail” button work.

### Scenario 5: Login e-mail stays private (negative)
- When the owner has no public e-mail, then neither the page HTML nor `GET /public/profiles/{nick}` contains the login e-mail.

### Scenario 6: Not allowed (negative)
- When the e-mail is not confirmed, then publish returns 403 `email_not_confirmed` and the button is disabled with an explanation.
- When a visitor opens an unknown nick, then the same 404 page as for an unpublished one is returned.

## Report

**Done.** Approved after 2 review rounds. `published_profiles` snapshot (migration `0005`, schema version 1 = the draft content model), `POST /me/profile/publish` (403 `email_not_confirmed` / `profile_blocked`, 409 `draft_conflict`, 422 `profile_incomplete` without a nick; idempotent for an unchanged draft), `POST /me/profile/unpublish` (idempotent, snapshot kept), `GET /public/profiles/{nick}` (`Cache-Control: no-store`, case-insensitive, one 404 for unknown, never published, unpublished and blocked pages); `OwnerProfile` now reports `hasUnpublishedChanges`, `publishedAt` and `publicUrl`. Client: `/user/{nick}` server-rendered from the snapshot (Classic layout without a banner: initials avatar, name, headline, „Napisz e-mail”, footer „Utworzono w Profilo” and „Zgłoś nadużycie”), title „{name} — {headline}”, permanent redirect to the lower-case nick, shared 404 page (`app/not-found.tsx`); panel section with the status badge and the publish actions.

Acceptance criteria (verified in the browser, with curl on the running stack and by tests):
- S1 first publication — met: after confirming the e-mail with the link from Mailpit, „Opublikuj” in the panel published the page; `/user/anna-wisniewska-3` shows it; changing the nick afterwards → 409 `nick_locked`.
- S2 publish changes — met: after a draft change the panel shows „Masz nieopublikowane zmiany” and visitors still see the old headline until publishing.
- S3 unpublish — met: „Ukryj stronę” → the next request to the page returns 404; „Opublikuj” then shows the current draft („Nowy nagłówek w szkicu”).
- S4 without JavaScript — met: the HTML from curl contains the name, headline and `href="mailto:…"`.
- S5 login e-mail private — met: neither the HTML nor the API response contains the login e-mail when no public e-mail is set (test) — and the page HTML did not contain it with a public e-mail either.
- S6 not allowed — met: publish with an unconfirmed e-mail → 403 `email_not_confirmed`, the button is disabled with „Potwierdź adres e-mail, żeby opublikować stronę.”; an unknown nick returns the same 404 page as an unpublished one.

Checks: api 176 tests, 99 %; client 138 tests, 95.8 % branches; contract 16 paths; `make images` passes.

Review round 1 fixes:
- The public e-mail is percent-encoded in the `mailto:` link (RFC 6068): `anna?cc=inna@example.pl` no longer adds a `cc` header (`mailtoHref`, tests with `? # % &`).
- `app/error.tsx` with Polish copy („Nie udało się wczytać strony”, „Spróbuj ponownie”) instead of Next's English error.
- „Unpublished changes” and publish idempotency compare the draft version stored with the snapshot (`published_profiles.draft_version`) instead of timestamps from two clocks; ADR 0002 amended.
- The public 404 also sends `Cache-Control: no-store`; S2 test checks that the flag clears and `publishedAt` moves forward.

Decision on API outages: the public page returns 500 (no false 404). Next.js renders `error.tsx` only in the browser, so with JavaScript off the 500 body is empty. A server-rendered error page would return 200 and could get an owner's page dropped from search results during an outage; a 500 makes crawlers retry. Verified with the production image and the API unreachable.

Decisions: abuse address is a placeholder (`naduzycia@profilo.pl`, `client/src/lib/publicProfile.ts`) until the operator details are known; „Opublikuj zmiany” is disabled with „Wszystkie zmiany są już na stronie.” when nothing changed; the panel shows the page address as a link (copy/QR come with TASK-014); the public page sets only the title (SEO is TASK-013).
