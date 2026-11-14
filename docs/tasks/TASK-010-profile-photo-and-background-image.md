---
id: TASK-010
title: Profile photo and background image
status: IN_PROGRESS
priority: high
iteration: ITER-02
depends_on: [TASK-008]
areas: [api, client]
materials:
  - docs/product/areas/profile.md
  - docs/architecture.md#media
  - docs/api/openapi.yaml
  - docs/design/mockups/final/screens.html#editor
---

## Goal
The owner uploads a square-cropped profile photo and an optional background image, which appear on the public page.

## Scope
- `media` module: fsspec storage adapter (local volume), upload endpoint with content sniffing, 10 MB and pixel limits, EXIF removal, WebP variants, `images` table.
- `GET /media/{id}/{size}.webp` with access rules (owner or visible published profile) and immutable caching.
- Client: upload buttons, square crop dialog for the avatar, progress and error states, remove action; public page uses `srcset`.
- Initials avatar and default hero graphic remain when no image is set.

## Out of scope
- Background usage in Split/Card layouts beyond the Classic banner (TASK-012).

## Scenarios

### Scenario 1: Upload photo
- When the owner uploads a 6 MB JPEG and crops it, then the avatar shows in the editor and, after publishing, on the public page in 128/256/512 px variants without EXIF data.

### Scenario 2: Visibility
- When the profile is unpublished, then the media URL of its images returns 404 to anonymous visitors but works for the owner.

### Scenario 3: Invalid file (negative)
- When the file is a PDF renamed to .jpg, then 415 `unsupported_image` is shown and the previous image stays.
- When the file is larger than 10 MB, then 413 `file_too_large` is shown.

## Technical notes
High-risk change (file upload): security review per code-review standard.

## Report

**Implemented, review round 1 fixed, waiting for re-review.** API: `media` module (Pillow processing in a worker thread, fsspec storage on the `media` volume, `images` table, upload limit 30/h per account), `PUT /me/profile/images/{kind}` (length checked before the form is parsed, 413 `file_too_large`, 415 `unsupported_image`, 422 `image_too_small` below 128 × 128 px for the photo and 640 × 200 px for the background), `DELETE /me/profile/images/{kind}`, `GET /media/{imageId}/{size}.webp` (owner with the access token, or a visible published page; the same 404 otherwise; `public, max-age=86400` for published images, `private, no-store` for drafts); avatar/background in the draft and the snapshot; replaced or removed images are deleted once neither the draft nor the published page shows them. Infra: `media` volume in both stacks, `/data/media` owned by the app user, Caddy body limit 1 MB (11 MB for image uploads). Client: photo crop dialog (`react-easy-crop`, drag, zoom slider, arrow keys, Escape), JPEG of at most 1024 px made in the browser (no EXIF), background uploaded as chosen, progress bar, errors under the field, remove buttons, draft images shown with the access token (blob URLs); public page: photo with `srcset` 128/256/512, background as the Classic banner with `srcset` 960/1600/2400; without images the initials and the page without a banner stay.

Acceptance criteria (verified in the browser, with curl and by tests):
- S1 upload photo — met: an 8.8 MB JPEG made in the browser was cropped and saved (1024 × 1024 sent, 480 kB), the photo shows in the editor and, after „Opublikuj zmiany”, on the public page with `srcset` 128/256/512; an API test uploads a 6–10 MB JPEG with EXIF (camera, GPS, orientation) and checks that every variant is WebP of the right size without EXIF.
- S2 visibility — met: a draft image returns 404 to visitors and to other owners and 200 to its owner; after publishing it is public; after hiding the page it returns 404 to visitors and still 200 to the owner (API test).
- S3 invalid file — met: a PDF renamed to `.jpg` showed „To nie jest obraz JPG, PNG ani WebP. Wybierz inny plik.” and the previous background stayed (browser and API test); more than 10 MB → 413 `file_too_large` (API test; the editor refuses such files before uploading).

Checks: api 289 tests, 99 %; client 277 tests, 95.5 % branches; contract 21 paths; `alembic check` clean.

Review round 1 fixes:
- Memory: the pixel limit is 24 Mpx (was 40), JPEGs are decoded at a reduced scale when much bigger than needed, large images are box-reduced before the final resize, and at most two images are processed at a time in their own threads (image serving keeps the default pool); measured peak about 100 MB per image (was up to 550 MB for small „bomb” files); the API container gets `mem_limit: 1536m` on servers.
- Clean-up race: unused images are found and their rows deleted while the profile row is locked, before the commit (files after it), so a concurrent upload or publish can no longer be pruned by a stale view.
- Files written for an upload that then fails (storage, database) are deleted.
- Visibility check is one lookup of the image owner's snapshot (was a scan of all snapshots).
- Colour profiles are converted to sRGB before they are dropped (wide-gamut phone photos no longer look washed out).
- Tests: blocked page hides images from visitors; metadata test inputs now carry ICC, XMP and PNG text; colour conversion; 24 Mpx limit; clean-up after failures.
- Published images are cached for a day instead of a year, so an unpublished or blocked page stops showing them soon also where they were cached (decision, see below).

Decisions: published images `Cache-Control: public, max-age=86400` (the architecture said a year; a day keeps PUB-BR-6/10 meaningful for browsers that already loaded them); minimum sizes 128 × 128 px (photo) and 640 × 200 px (background); backgrounds are never upscaled (a smaller one is served at its own width for every size); the server crops the photo to a square in the middle if the browser did not; transparency is kept (WebP with alpha); colour profiles are dropped (sRGB assumed); the Classic page shows a banner only when a background is set. New dependencies: Pillow 13.0.0, fsspec 2026.9.0, python-multipart 0.0.33 (api), react-easy-crop 6.2.4 (client).
