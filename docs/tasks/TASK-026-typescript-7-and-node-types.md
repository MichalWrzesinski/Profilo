---
id: TASK-026
title: TypeScript 7 and Node 26 type definitions
status: PROPOSED
priority: low
iteration: ITER-05
depends_on: []
areas: [client]
materials:
  - client/package.json
  - client/tsconfig.json
---

## Goal
The client type-checks with the current TypeScript major and type definitions matching the Node 26 runtime.

## Scope
- `@types/node` 24 → 26 (runtime is Node 26).
- `typescript` 5.9 → 7 (native compiler); adjust `tsconfig.json` and tooling (Next.js, ESLint TypeScript plugin) as needed.

## Out of scope
- Refactoring application code beyond what the new compiler requires.

## Scenarios

### Scenario 1: Type check passes
- When `make lint-client` runs, then `tsc` with TypeScript 7 reports no errors and Next.js builds.

### Scenario 2: Type errors are still caught (negative)
- When a component passes a wrong prop type, then `make lint-client` fails.

## Technical notes
Found in the dependency-updates review (2026-11-10): Dependabot's open-PR limit hid these updates; limit raised to 10.

## Report
Filled in by development after the task.
