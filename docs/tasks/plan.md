# Iteration plan

Version 1 of Profilo. Task files are the source of truth for scope and status; this page shows iterations and order.

## ITER-00 — Foundation

An empty Profilo app runs locally with one command, passes CI and is deployed automatically to staging.

| Order | Task | Priority | Depends on | Areas |
|---|---|---|---|---|
| 1 | [TASK-001 Project skeleton and local environment](TASK-001-project-skeleton-and-local-environment.md) | highest | — | api, client, infra |
| 2 | [TASK-002 CI pipeline with the required `check` job](TASK-002-ci-pipeline-with-the-required-check.md) | highest | TASK-001 | infra |
| 3 | [TASK-003 Staging server and automatic deployment](TASK-003-staging-server-and-automatic-deployment.md) | highest | TASK-002 | infra |

## ITER-01 — First page online

A new user registers, confirms the e-mail, chooses a nick and publishes a minimal public page.

| Order | Task | Priority | Depends on | Areas |
|---|---|---|---|---|
| 1 | [TASK-004 Registration, login, logout and session refresh](TASK-004-registration-login-logout-and-session-refresh.md) | highest | TASK-001 | api, client |
| 2 | [TASK-005 E-mail confirmation and transactional e-mail](TASK-005-e-mail-confirmation-and-transactional-e.md) | highest | TASK-004 | api, client |
| 3 | [TASK-006 Wizard step 1: display name and nick](TASK-006-wizard-step-1-display-name-and.md) | highest | TASK-004 | api, client |
| 4 | [TASK-007 Publish, unpublish and the minimal public page](TASK-007-publish-unpublish-and-the-minimal-public.md) | highest | TASK-005, TASK-006 | api, client |

## ITER-02 — Complete content

The owner fills in all content — details, contact, links and images — with autosave and a live preview.

| Order | Task | Priority | Depends on | Areas |
|---|---|---|---|---|
| 1 | [TASK-008 Editor: details and contact with autosave](TASK-008-editor-details-and-contact-with-autosave.md) | high | TASK-007 | api, client |
| 2 | [TASK-009 Links: add, edit, remove and reorder](TASK-009-links-add-edit-remove-and-reorder.md) | high | TASK-008 | api, client |
| 3 | [TASK-010 Profile photo and background image](TASK-010-profile-photo-and-background-image.md) | high | TASK-008 | api, client |
| 4 | [TASK-011 Live preview and wizard step 3–4](TASK-011-live-preview-and-wizard-step-3.md) | high | TASK-009, TASK-010 | client |

## ITER-03 — Look and sharing

The owner chooses one of three layouts and an accent colour, and shares the page with a link preview and a QR code.

| Order | Task | Priority | Depends on | Areas |
|---|---|---|---|---|
| 1 | [TASK-012 Layouts Split and Card, accent colours and wizard step 2](TASK-012-layouts-split-and-card-accent-colours.md) | high | TASK-011 | api, client |
| 2 | [TASK-013 Link previews and SEO for public pages](TASK-013-link-previews-and-seo-for-public.md) | medium | TASK-012 | api, client |
| 3 | [TASK-014 Published screen, sharing menu and QR code](TASK-014-published-screen-sharing-menu-and-qr.md) | medium | TASK-012 | api, client |

## ITER-04 — Account management

The owner can recover and change the password and delete the account; the system cleans up unconfirmed accounts and released nicks.

| Order | Task | Priority | Depends on | Areas |
|---|---|---|---|---|
| 1 | [TASK-015 Password reset](TASK-015-password-reset.md) | high | TASK-005 | api, client |
| 2 | [TASK-016 Account settings: change password and delete account](TASK-016-account-settings-change-password-and-delete.md) | high | TASK-015 | api, client |
| 3 | [TASK-017 Cleanup jobs: unconfirmed accounts, quarantine and orphaned images](TASK-017-cleanup-jobs-unconfirmed-accounts-quarantine-and.md) | medium | TASK-016 | api |
| 4 | [TASK-018 Registration bot protection (ALTCHA)](TASK-018-registration-bot-protection-altcha.md) | medium | TASK-004 | api, client |

## ITER-05 — Release readiness

The service has a landing page, legal pages, abuse handling, production deployment, backups and monitoring.

| Order | Task | Priority | Depends on | Areas |
|---|---|---|---|---|
| 1 | [TASK-021 Production deployment and rollback](TASK-021-production-deployment-and-rollback.md) | highest | TASK-003 | infra |
| 2 | [TASK-022 Daily off-site backups and restore test](TASK-022-daily-off-site-backups-and-restore.md) | high | TASK-021 | infra |
| 3 | [TASK-023 Error and uptime monitoring](TASK-023-error-and-uptime-monitoring.md) | high | TASK-003 | infra, api, client |
| 4 | [TASK-019 Landing page and legal pages](TASK-019-landing-page-and-legal-pages.md) | high | TASK-012 | client |
| 5 | [TASK-020 Abuse reports and operator blocking](TASK-020-abuse-reports-and-operator-blocking.md) | medium | TASK-007 | api, client |

## Needed to complete ITER-00 (from the user)

- Hetzner Cloud account with the CX23 staging server (or an API token to create it).
- Domain (e.g. `profilo.pl`) with a DNS record for staging (e.g. `staging.profilo.pl`).
- Repository secrets for staging SSH (`STAGING_SSH_HOST`, `STAGING_SSH_KEY`).
- Brevo account and staging SMTP key (needed by TASK-005 on staging; locally Mailpit).

## Before production (from the readiness gate)

- Production DNS; SPF, DKIM, DMARC for Brevo.
- Hetzner CX33 (production) and Storage Box.
- Brevo production SMTP key.
- Sentry (EU region) and Better Stack Uptime accounts.
- Operator data (company or person, address, contact e-mail) for terms, privacy policy and abuse reports; review of the legal texts drafted in TASK-019.
- Repository secrets `PROD_*` (no GitHub environments on the free plan).

## Assumptions to check on staging

- Wizard order (name and address → look → content → preview) and "Dokończę później" exit.
- Card layout shows links as icons; list below the card when more than 6 links.
- Registration reveals an already registered e-mail, protected by rate limits and ALTCHA.
- 5-minute goal: measured on staging with the E2E flow and a manual run by the user.
