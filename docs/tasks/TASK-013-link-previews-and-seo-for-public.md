---
id: TASK-013
title: Link previews and SEO for public pages
status: READY
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
Filled in by development after the task.
