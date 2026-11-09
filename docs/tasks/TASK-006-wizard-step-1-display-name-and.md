---
id: TASK-006
title: Wizard step 1: display name and nick
status: READY
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
- Client: wizard shell with stepper, step 1 screen with live check (debounce 300 ms), suggestion chips, states: checking, available, taken, invalid.

## Out of scope
- Steps 2–4 of the wizard (TASK-009, TASK-011, TASK-012).

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
Filled in by development after the task.
