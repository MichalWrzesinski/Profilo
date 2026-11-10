---
id: TASK-006
title: Wizard step 1: display name and nick
status: IN_PROGRESS
priority: highest
iteration: ITER-01
depends_on: [TASK-004]
areas: [api, client]
materials:
  - docs/product/areas/profile.md#nick
  - docs/api/openapi.yaml
  - docs/design/mockups/final/screens.html#wizard-nick
  - docs/design/mockups/final/screens.html#wizard-nick-ok
---

## Goal
The owner gets a nick proposed from the display name, sees availability live and reserves an available nick.

## Scope
- Nick normalisation (PRF-BR-2) as a shared pure function with unit tests, including Polish letters.
- Reserved nicks table seeded with the system list (PRF-BR-4); endpoints `GET /nicks/suggestion`, `GET /nicks/{nick}/availability`, `PUT /me/profile/nick` with suggestions (PRF-BR-5).
- Nick assignment and uniqueness in one transaction (PRF-BR-6); change allowed until first publication (PRF-BR-7).
- Client: wizard shell with stepper, step 1 screen with live check (debounce 300 ms), suggestion chips, states: checking, available, taken, invalid. Until later steps exist, „Dalej” leads to the panel.

## Out of scope
- Wizard step 2 (TASK-012) and steps 3–4 (TASK-011).

## Scenarios

### Scenario 1: Proposal
- When the display name is "Anna Wiśniewska", then the proposed nick is "anna-wisniewska".
- When the display name yields fewer than 3 valid characters, then no proposal is made and the field is empty.

### Scenario 2: Available nick
- When the owner types an available nick and continues, then the nick is assigned to the profile.

### Scenario 3: Taken nick (negative)
- When the nick is taken or reserved, then the field shows the error and up to 3 available suggestions; clicking one fills the field.
- When two users save the same nick at the same time, then exactly one succeeds and the other gets 409 with suggestions.

### Scenario 4: Invalid format (negative)
- When the nick has 2 characters, a leading hyphen or "--", then 422 with the rule text is shown.

## Report

**Implemented, waiting for review.** Nick rules (PRF-BR-2) in `profiles/nicks.py` and `client/src/lib/nick.ts` with identical test cases (Polish letters, spaces, hyphens, 40-character cut at a word boundary); `reserved_nicks` table (migration `0004`, system list and offensive words, optional expiry); `GET /nicks/suggestion`, `GET /nicks/{nick}/availability` (120/min per account), `PUT /me/profile/nick` (409 `nick_taken` / `nick_reserved` / `nick_locked` with up to 3 suggestions, 422 with the rule text); wizard shell `/kreator` with stepper and „Dokończę później”, step 1 with live check (300 ms debounce) and suggestion chips; registration now lands on `/kreator`, „Dalej” leads to the panel until later steps exist.

Acceptance criteria (verified in the browser and by tests):
- S1 proposal — met: „Anna Wiśniewska” → `anna-wisniewska` (unit tests on both sides); in the browser, with that nick taken by another account, the proposal was `anna-wisniewska-2`; names with fewer than 3 valid characters give no proposal (tests).
- S2 available nick — met: picked `anna-wisniewska-3`, changed the name to „Anna Wiśniewska-Nowak”, „Dalej” saved both (database: nick and name stored, version 3) and opened the panel; reopening `/kreator` shows the saved values.
- S3 taken nick — met: typing „Anna Wiśniewska” normalised live to `anna-wisniewska`, showed „Ten adres jest już zajęty.” and three chips; clicking a chip filled the field and showed „Adres wolny.”; reserved nicks and the unique-index race (IntegrityError → 409 with suggestions) covered by API tests.
- S4 invalid format — met: 2 characters, a leading hyphen and „--” return 422 with the rule text (API tests) and show the rule under the field (client tests).

Checks: api 150 tests, 99.3 %; client 92 tests, 95.0 % branches; contract 13 paths.

Pulled forward from TASK-008: the full `PATCH /me/profile` backend (optimistic `version`, 409 `draft_conflict` with the current state, empty strings → null, phone to E.164 with default +48, 422 `invalid_phone`), because step 1 edits the display name. TASK-008 keeps the editor and autosave.

Found and fixed during live verification: a registration submitted before hydration went out as a native GET form and put the password in the URL — the login and registration forms now use `method="post"`.

Decisions: the server normalises input only lightly (lowercase, Polish letters, spaces → hyphens) so hyphen errors stay visible as 422 instead of being silently fixed; suggestions try `{nick}-{city}` first when a city is set, then `-2`, `-3` …; the address prefix shows the current host (`localhost:8080` locally).
