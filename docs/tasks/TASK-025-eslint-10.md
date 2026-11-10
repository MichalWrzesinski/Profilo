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
Filled in by development after the task.
