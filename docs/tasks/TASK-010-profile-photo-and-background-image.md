---
id: TASK-010
title: Profile photo and background image
status: READY
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
Filled in by development after the task.
