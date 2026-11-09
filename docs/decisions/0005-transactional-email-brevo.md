# 0005. Transactional e-mail with Brevo

Status: accepted — approved by the user (2026-11-09)

## Context

Profilo sends only transactional e-mails (confirmation, password reset, security notices, account deletion), under 3 000 per month at start. Compared: Brevo, Amazon SES (eu-central-1), Postmark — see `docs/technology-summary.md`.

## Decision

Use Brevo over SMTP through the `notifications` adapter: free plan (300 e-mails/day) at start, Starter plan when volume grows. Separate sender domains/keys for staging and production; SPF, DKIM and DMARC configured on the domain.

## Consequences

- EU company and processing, no cost at start.
- SMTP keeps the code provider-neutral; switching to SES or Postmark is a configuration change.
- Free-plan daily limit: monitor send failures; upgrade before it is reached.
