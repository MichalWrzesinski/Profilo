---
id: TASK-007
title: Publish, unpublish and the minimal public page
status: READY
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
Filled in by development after the task.
