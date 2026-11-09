---
id: TASK-023
title: Error and uptime monitoring
status: READY
priority: high
iteration: ITER-05
depends_on: [TASK-003]
areas: [infra, api, client]
materials:
  - docs/standards/development/deployment.md#monitoring-i-alerty
  - AGENTS.md
---

## Goal
Errors in api, worker and client and unavailability of staging and production are reported and alerted.

## Scope
- Sentry SDK in api, worker and client (EU region, `send_default_pii` off, sensitive fields filtered), release = commit SHA, environment name; CI creates releases and uploads client source maps without publishing them.
- Better Stack Uptime monitors for `/ready` on staging and production; alerts by e-mail on downtime, error spikes and failed deployments.

## Out of scope
- Performance tracing and dashboards.

## Scenarios

### Scenario 1: Error reported
- When an unhandled exception occurs in the api, then it appears in Sentry with the release and environment and without personal data.

### Scenario 2: Downtime
- When `/ready` fails for 2 minutes, then an alert e-mail is sent.

### Scenario 3: No PII (negative)
- When an error happens during registration, then the Sentry event contains no e-mail, password or token.

## Technical notes
Needs from the user: Sentry and Better Stack accounts and their keys as repository secrets.

## Report
Filled in by development after the task.
