# Plan

Version 1 of Profilo: iterations ITER-00 – ITER-05 are done and run on staging (`https://profilo.gitpush.app`). Finished tasks were removed in the pre-production clean-up; their reports stay in Git history and in the pull requests (the commit and PR titles carry the task id). Task files are the source of truth for scope and status.

## Open tasks

| Task | Status | Waits for |
|---|---|---|
| [TASK-021 Production deployment and rollback](TASK-021-production-deployment-and-rollback.md) | BLOCKED | Production server, domain, `PROD_*` secrets — the owner's decision to go to production |
| [TASK-022 Daily off-site backups and restore test](TASK-022-daily-off-site-backups-and-restore.md) | BLOCKED | Production and a Storage Box with `PROD_BACKUP_*` |
| [TASK-025 Move the client to ESLint 10](TASK-025-eslint-10.md) | PROPOSED | ESLint 10 support in `eslint-plugin-import`, `-react`, `-jsx-a11y` |
| [TASK-026 TypeScript 7 and Node 26 type definitions](TASK-026-typescript-7-and-node-types.md) | BLOCKED | TypeScript 7 support in `typescript-eslint` (Node types done) |

## Before production (from the readiness gate)

- Production server (Hetzner CX33 or another), domain and DNS; SPF, DKIM, DMARC for the production sender in Brevo.
- Storage Box and `PROD_BACKUP_*` (runbook „Backups”); `PROD_SENTRY_*` and a Better Stack monitor for production (runbook „Monitoring”).
- Repository secrets and variables `PROD_*` (runbook „Production”; no GitHub environments on the free plan).
- Legal review of `/regulamin` and `/prywatnosc` and the remaining marked fields: processor agreements and data regions (Hetzner or the chosen server provider, Brevo, Sentry), the provider of the operator's mailbox (the VPS company), backups confirmation. Operator data and contacts are filled in (`client/src/lib/operator.ts`).
- `ABUSE_EMAIL` in the production server `.env`, and a mailbox that receives it.
- Manual operator processes the legal drafts promise: acknowledging abuse notices and informing notifiers and owners (DSA art. 16, 17), answering complaints within 14 days, announcing changes of the terms 14 days ahead by e-mail (no bulk e-mail feature in the app), deleting abuse reports 12 months after they were dealt with.

## Assumptions to check on staging

- Wizard order (name and address → look → content → preview) and "Dokończę później" exit.
- Card layout shows links as icons; list below the card when more than 6 links.
- Registration reveals an already registered e-mail, protected by rate limits and ALTCHA.
- 5-minute goal: measured on staging with the E2E flow and a manual run by the user.
