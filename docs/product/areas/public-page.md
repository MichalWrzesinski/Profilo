# Public page

## Purpose

Shows the published profile to visitors in one of three layouts and makes contact one tap away. Also covers the service's legal pages and the abuse-report path.

## Roles and permissions

| Role | Can |
|---|---|
| Visitor | View published pages, use contact buttons and links, report abuse |
| Owner | Choose layout and accent colour (in the draft) |
| Operator | Block a page reported as illegal, via CLI |

## User stories

- PUB-US-1: As an owner, I want to choose one of three layouts — Classic, Split, Card — so that the page fits my style.
- PUB-US-2: As an owner, I want to pick an accent colour from a palette, so that the page matches my brand without risk of an unreadable result.
- PUB-US-3: As a visitor, I want a fast, readable page with clear contact buttons on my phone, so that I can contact the person in one tap.
- PUB-US-4: As an owner, I want my link to show my name, headline and photo when shared on social media and messengers, so that it looks professional.
- PUB-US-5: As a visitor, I want to report a page with illegal content, so that the operator can act on it.
- PUB-US-6: As an owner, I want to download a QR code of my page address, so that I can put it on a printed business card or slide.

## Business rules

- PUB-BR-1: Layouts:
  - Classic — avatar, name, headline, details, bio, contact buttons and links in one centred column; optional background image as a banner at the top.
  - Split — background image (or accent colour) fills one side on desktop and the top on phones; content on the other side.
  - Card — compact card centred on the background image or a solid accent-colour background.
- PUB-BR-2: Every layout works from 320 px wide phones to wide desktops and in all three meets WCAG 2.1 AA contrast; text over images uses an overlay that guarantees contrast.
- PUB-BR-3: Accent colour is chosen from a predefined palette of 8 colours, each tested for contrast with white and dark text in every layout.
- PUB-BR-4: Content order is fixed per layout: identity (avatar, name, headline), details (position, company, city), contact buttons (e-mail, phone), bio, links. The owner controls only link order.
- PUB-BR-5: Contact buttons: "Napisz e-mail" → `mailto:`, "Zadzwoń" → `tel:`. External links open in a new tab with `rel="noopener noreferrer"` and `nofollow ugc`.
- PUB-BR-6: Address `/user/{nick}` for a nick that does not exist, is unpublished, blocked or in quarantine returns the same 404 page, so nothing leaks about the account.
- PUB-BR-7: Each published page has a title "{display name} — {headline}", a meta description from the bio, an Open Graph image (avatar or generated card) and a canonical URL. Pages are indexable by search engines.
- PUB-BR-8: The public page is rendered on the server and works without JavaScript.
- PUB-BR-9: The public page footer contains a small "Created with {product}" link and a "Report abuse" link.
- PUB-BR-10: Abuse report in v1 is a `mailto:` link to the operator's address with the page address pre-filled in the subject. The operator blocks a page with a CLI command; the owner sees "Page blocked — contact support" in the panel.
- PUB-BR-11: The service has public pages: home (landing with "Create your page"), terms of service, privacy policy.
- PUB-BR-12: After the first publication the panel offers a QR code of the page address for download as PNG (1024 px) and SVG: dark modules on a light background with a quiet zone, encoding the canonical URL.

## Statuses

Visibility is derived from the profile status (see [Profile](profile.md)): only `published` is visible.

## Limits and validation

- Public page response: server-rendered HTML, images in responsive sizes; target Largest Contentful Paint under 2.5 s on mobile.

## Notifications

None.

## Edge cases

- Very long display name or link labels: wrap without breaking the layout.
- No avatar, no background, no links: page still looks complete (initials avatar, accent background).
- Owner deletes the account while a visitor has the page open: next load returns 404.

## Open questions

None.
