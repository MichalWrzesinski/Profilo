---
id: TASK-009
title: Links: add, edit, remove and reorder
status: IN_PROGRESS
priority: high
iteration: ITER-02
depends_on: [TASK-008]
areas: [api, client]
materials:
  - docs/product/areas/profile.md
  - docs/api/openapi.yaml
  - docs/design/mockups/final/screens.html#editor
  - docs/design/mockups/final/screens.html#editor-empty
  - docs/design/design-system.html#profile
---

## Goal
The owner manages up to 20 labelled links in a chosen order, shown as link cards on the public page.

## Scope
- Link endpoints (add, update, delete, reorder), URL validation and normalisation (http/https only), service detection for known domains (PRF-BR-11).
- Editor section with empty state, inline add/edit form, drag-and-drop with keyboard support and ↑/↓ buttons on mobile.
- Public page link cards with service icon tiles, `rel="nofollow ugc noopener noreferrer"`, new tab.

## Out of scope
- Icon-only links of the Card layout (TASK-012).

## Scenarios

### Scenario 1: Add and reorder
- When the owner adds "linkedin.com/in/anna-wisniewska" without a label, then the link is saved as https with label "LinkedIn" and the LinkedIn icon.
- When the owner drags a link to the top, then the new order is saved and used on the public page after publishing.

### Scenario 2: Edit and remove
- When the owner edits a label or removes a link, then the change is saved in the draft.

### Scenario 3: Invalid link (negative)
- When the URL contains spaces or uses `javascript:`, then 422 `invalid_url` and the field message are shown.
- When the owner tries to add a 21st link, then 409 `links_limit_reached` is shown.

## Report

**Implemented, review round 1 fixed, waiting for re-review.** API: `POST /me/profile/links` (201 with `Location`), `PATCH` and `DELETE /me/profile/links/{linkId}` (delete idempotent), `PUT /me/profile/links/order` (exactly the existing ids, else 422 `link_order_mismatch`); URL rules in `profiles/links.py` (`https://` added when missing, only http/https, no spaces or control characters, no other schemes such as `javascript:`/`mailto:`/`data:`, no `user@host`, a real domain; 422 `invalid_url` with the mockup message); service detection for the nine services including subdomains (`pl.linkedin.com`, `youtu.be`, `twitter.com` → X), default label = service name or domain; at most 20 (409 `links_limit_reached`); every change bumps the draft version so „Masz nieopublikowane zmiany” appears; links are in the published snapshot. Editor: „Linki” section with the empty state, counter, inline add/edit form, delete, drag and drop with mouse and keyboard (Space, arrows, Space; Polish screen reader instructions and announcements), ↑/↓ buttons instead of the handle on phones. Link changes wait for pending autosaves and autosave waits for them (`useAutosave.exclusive`), so they never send the same draft version. Public page: „Znajdziesz mnie tutaj” with link cards (service tile, label, short address, arrow), new tab, `rel="nofollow ugc noopener noreferrer"`, „(otwiera się w nowej karcie)” for screen readers.

Acceptance criteria (verified in the browser and by tests):
- S1 add and reorder — met: „linkedin.com/in/anna-wisniewska” without a label was saved as `https://linkedin.com/in/anna-wisniewska`, label „LinkedIn”, tile „in”; Behance moved to the top with the keyboard; after „Opublikuj zmiany” the public page lists Behance first (also an API test with three links).
- S2 edit and remove — met: label edit, URL change (service follows), delete (API and client tests).
- S3 invalid link — met: „mój portfolio.pl” showed „To nie wygląda na adres strony. Sprawdź, czy nie ma w nim spacji.” under the field; `javascript:alert(1)` → 422 `invalid_url` (tests); the 21st link → 409 `links_limit_reached`, and the editor disables „Dodaj link” at 20.

Checks: api 246 tests, 99 %; client 237 tests, 95.4 % branches; contract 19 paths.

Review round 1 fixes:
- The URL is rebuilt from its parsed parts and parsed again, so lower-casing a host such as „İ” (which grows by one character) can no longer move text between host and path or create a hidden `user@host`; invisible characters (zero-width, bidi overrides, other control and format characters) are refused; port 0 is refused; hosts with letters from scripts other than Latin are stored in punycode, so a look-alike such as Cyrillic „apple.com” shows as `xn--pple-43d.com`.
- Link changes in the editor run one after another; autosave waits until the last one ends and continues from its version (no false conflict after quick ↑/↓ or deletes); an older profile never replaces a newer one; the row buttons wait while a change runs.
- After a delete the profile is read again (two attempts) and a failure is reported.
- Focus stays useful: after a delete on the next link (or „Dodaj link”), after saving or cancelling a form on its link or „Dodaj link”, after ↑/↓ at the first or last place on the other arrow; ↑/↓ moves are announced („Link X jest teraz na miejscu N z M.”).
- `PATCH` of a link with no field or `url: null` returns 422; the link form gets the danger border when it shows an error (mockup #editor-error).

Decisions: service tiles are short marks („in”, „GH”, „Bē” …) as in the design system, no brand logos; a globe for other sites; URL path and query are kept as typed (only scheme and host are lower-cased); deleting a link does not ask for confirmation (as in the mockup). New dependencies: `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2 (the stack in AGENTS.md).
