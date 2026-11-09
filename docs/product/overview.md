# Product overview

> Status: confirmed by the user after discovery round 1 (2026-11-09).

## Product

A web app for creating a simple, professional personal page that works as an online business card. A user describes themselves, shares chosen contact details and collects links to their profiles in one place, under one permanent address `example.com/user/{nick}`. No technical knowledge is required. Product name: **Profilo**. Positioning: a Polish-language competitor of about.me, visually richer.

## Problem

Freelancers, specialists and entrepreneurs need one stable link to put in a CV, e-mail footer, social media bio or on a printed business card. Building a personal website is too time-consuming, and social profiles are scattered and controlled by third parties.

## Users and roles

| Role | Description | Main goals |
|---|---|---|
| Visitor | Anyone opening a public page, no account | Learn who the person is, contact them in one tap, open their profiles |
| Owner | Registered user with one profile | Create, preview, publish and maintain their page in about five minutes |
| Operator | The company running the service, no in-app panel | Handle abuse reports and block illegal content using a CLI command|

## Goals

- A new user publishes a complete, good-looking page in about 5 minutes (measured in usability tests on staging: registration → published page).
- Every public page renders correctly on phones and desktops and passes accessibility contrast checks for every layout and accent colour.
- Shared links keep working: a nick never changes after the first publication.

## Version 1 scope

Areas: [Accounts](areas/accounts.md), [Profile](areas/profile.md), [Public page](areas/public-page.md).

Must stories:

- ACC-US-1 … ACC-US-7 — registration, e-mail confirmation, login, logout, password recovery, password change, account deletion.
- PRF-US-1 … PRF-US-9 — onboarding wizard, nick, content, images, contact, links, draft autosave, preview, publish / unpublish.
- PUB-US-1 … PUB-US-6 — three layouts, accent colour, public page, link previews, legal pages and abuse report, QR code.

## Later

| Story | Priority |
|---|---|
| Change of login e-mail with re-confirmation | Should |
| "Discard changes" — revert draft to the published version | Should |
| Option to hide the page from search engines (`noindex`) | Should |
| Public page labels in English (page language setting) | Could |
| Download contact as vCard ("Save contact") | Could |
| Custom accent colour (free colour picker with contrast check) | Could |
| Built-in background graphics library | Could |
| Nick change after publication with redirect from the old address | Won't now |
| Social login (Google, LinkedIn) | Won't now |
| Admin panel, payments, custom domains, user search, visit statistics, contact form, social features | Won't now (excluded by the brief) |

## Constraints

- Interface language: Polish, also for labels on public pages. Product documentation: English.
- GDPR: privacy policy, terms of service, account deletion with all data, EXIF metadata stripped from uploaded images, login e-mail never published.
- EU Digital Services Act: as a hosting service the product needs a notice-and-action mechanism for illegal content — covered by PUB-US-5 without an admin panel.
- Only essential cookies (session) — no consent banner.
- External services (chosen in the technology stage): transactional e-mail, image storage.
- Operator details (company or person) for the terms, privacy policy and abuse e-mail are supplied by the user before production; until then placeholders are used.
- Production domain not chosen yet; `example.com` is a placeholder kept in configuration.
