---
id: TASK-013
title: Link previews and SEO for public pages
status: IN_PROGRESS
priority: medium
iteration: ITER-03
depends_on: [TASK-012]
areas: [api, client]
materials:
  - docs/product/areas/public-page.md
  - docs/design/brand/
---

## Goal
Shared profile links show the name, headline and photo in messengers and social media, and pages are indexable.

## Scope
- Server-rendered `<title>`, meta description, canonical URL, Open Graph and Twitter card tags.
- Open Graph image: avatar JPEG variant or a generated 1200×630 card (name, headline, accent) when no avatar.
- Sitemap of published profiles and robots.txt; panel pages `noindex`.

## Out of scope
- Hiding from search engines option (Later).

## Scenarios

### Scenario 1: Preview tags
- When a published page is fetched, then title "{name} — {headline}", description from the bio and an og:image URL returning 200 are present.

### Scenario 2: Performance
- When a published page with an avatar is measured with Lighthouse (mobile) on staging, then Largest Contentful Paint is under 2.5 s.

### Scenario 3: Unpublished (negative)
- When the page is unpublished, then it is removed from the sitemap and its URL returns 404.

## Report

**Implemented, in review.** Every published page has a server-rendered title „{name} — {headline}”, a meta description (the bio cut at a word boundary to 160 characters; without a bio a sentence from headline, position, company and city), the canonical URL, Open Graph (`profile`, `pl_PL`, 1200 × 630 image) and a `summary_large_image` Twitter card, plus schema.org `ProfilePage`/`Person` JSON-LD (name, headline, job, company, city, photo, links as `sameAs`; `<` escaped). The preview image is a card drawn by the API with Pillow: accent background, the photo (or initials) in a white ring, name, headline, page address and the wordmark, in the brand font (Plus Jakarta Sans, OFL, bundled). `robots.txt` allows everything except `/api/` (the cards stay allowed) and points at `sitemap.xml`, which lists home, terms, privacy and every visible published page with its publication date. `/panel`, `/kreator` and `/edytor` are `noindex, nofollow` (login, registration, confirmation and preview already were).

Acceptance criteria:
- S1 preview tags — met: E2E publishes a page and checks the title, description, Open Graph and Twitter tags and the canonical URL, then fetches the og:image URL: 200 `image/jpeg`. Checked with curl too (card 45 kB, `public, max-age=86400`); API tests check the card size, the accent and the photo by pixel sampling.
- S2 performance — partly verified: staging does not exist yet (TASK-003 is blocked), so Lighthouse 13.6.0 (mobile preset, simulated throttling) ran locally against the production client image behind Caddy with the real API: LCP 0.6 s, CLS 0, performance 99–100, SEO 100, accessibility 100 on a page with a photo and on one with a background image. Repeat on staging when it exists. The avatar now loads with `fetchpriority="high"`.
- S3 unpublished — met: E2E unpublishes the page and checks that it leaves `sitemap.xml`, the page returns 404 and so does its card; API tests cover unpublished, blocked, never published and unknown nicks, including a card that was cached before the page was hidden.

Checks: api 314 tests, 99 %; client 357 tests, 98 % statements / 95.8 % branches; contract 23 paths; E2E 6 tests pass locally.

Decisions: one generated card for every page instead of the avatar's JPEG variant (the architecture had planned that): a square photo is cropped badly in 1.91:1 previews and the card carries the name and headline into previews that print no text; no JPEG variants or backfill of existing photos needed. The card URL is versioned by the published draft version, so a republish gets a fresh preview in messengers that cache by URL. The sitemap holds at most 50 000 pages (one file); a sitemap index is needed beyond that. New asset: Plus Jakarta Sans variable TTF from github.com/google/fonts with its OFL licence. The client needs `PUBLIC_BASE_URL` (local compose and the server stack pass it). Known limitation: Pillow in the image has no raqm, so right-to-left names are drawn in logical order and emoji show as empty boxes on the card (the page itself is fine).

Review round 1 fixes: the card request gives back its database connection before waiting for a render thread, and renders are limited to 60 per minute per IP (cached cards are free), so a crawler burst or a Valkey outage cannot exhaust the connection pool; robots.txt opens only the card images, not the public JSON next to them; the cache key carries a renderer version; an empty name cannot crash the renderer; tests for a cached card after unpublishing and after blocking, and for the render limit.
