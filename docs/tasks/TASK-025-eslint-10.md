---
id: TASK-025
title: Move the client to ESLint 10
status: PROPOSED
priority: low
iteration: ITER-05
depends_on: []
areas: [client]
materials:
  - AGENTS.md
  - client/eslint.config.mjs
---

## Goal
The client lints with a supported ESLint major version without peer-dependency overrides.

## Scope
- Upgrade `eslint` to 10 once `eslint-config-next` and its plugins (`eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`) support it, or replace the import plugin if upstream stalls.
- Remove the Dependabot `ignore` rule for ESLint majors and the AGENTS.md pitfall.

## Out of scope
- New lint rules.

## Scenarios

### Scenario 1: Clean install and lint
- When dependencies are installed, then npm reports no ERESOLVE peer warnings for ESLint and `make lint-client` passes.

### Scenario 2: Rules still enforced (negative)
- When a file violates a Next.js core-web-vitals rule, then `make lint-client` fails.

## Technical notes
Trigger: upstream support for ESLint 10 in the three plugins (checked in the dependency-updates review, 2026-11-10: all cap ESLint at ^9).

## Report

**Checked 2026-11-16, still waiting.** The newest releases older than two weeks still cap ESLint at 9: `eslint-plugin-import` 2.32.0 (`^9`), `eslint-plugin-react` 7.37.5 (`^9.7`), `eslint-plugin-jsx-a11y` 6.10.2 (`^9`); `eslint-config-next` 16.4.4, `eslint-plugin-react-hooks` 7.1.1 and `typescript-eslint` 8.72.1 already accept 10. Nothing to change until the three plugins do (or the import plugin is replaced).
