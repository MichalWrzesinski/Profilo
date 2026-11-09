# Glossary

| Term | Definition | Code name |
|---|---|---|
| Account | A registered user identified by a login e-mail and password | `Account` |
| Login e-mail | E-mail used to log in and receive service messages; never shown publicly | `Account.email` |
| Owner | The person who owns an account and its profile | `owner` (role) |
| Visitor | Anyone viewing a public page without logging in | `visitor` (role) |
| Profile | The single personal page belonging to an account, with a draft and an optional published version | `Profile` |
| Display name | First and last name or pseudonym shown on the page | `display_name` |
| Nick | Unique, URL-safe identifier forming the page address `/user/{nick}` | `nick` |
| Reserved nick | A nick that cannot be taken: system words or a nick in quarantine after account deletion | `ReservedNick` |
| Draft | The editable version of the profile content, visible only to the owner | `ProfileDraft` |
| Published version | The snapshot of the draft shown to visitors after "Publish changes" | `ProfilePublished` |
| Publication | The act of copying the draft to the published version and making the page public | `publish` |
| Unpublishing | Hiding the public page while keeping the content | `unpublish` |
| Headline | Optional short line under the name, e.g. job title or specialisation | `headline` |
| Bio | Short description of the person | `bio` |
| Avatar | Profile photo | `avatar` |
| Background image | Optional graphic used by a layout | `background_image` |
| Public contact | Optional public e-mail and phone number shown as contact buttons | `public_email`, `public_phone` |
| Link | A labelled URL to a website or external profile, in owner-defined order | `ProfileLink` |
| Layout | One of three predefined page designs: Classic, Split, Card | `Layout` (`classic`, `split`, `card`) |
| Accent colour | One colour from a predefined palette used for buttons and highlights | `accent_color` |
| Abuse report | A notice from anyone that a page contains illegal content | `abuse report` (e-mail, no model in v1) |
