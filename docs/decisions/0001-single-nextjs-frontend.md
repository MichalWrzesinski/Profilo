# 0001. One Next.js app for landing, public pages and the owner panel

Status: accepted (2026-11-09)

## Context

The default stack separates a React + TypeScript frontend (`client/`) from a server-rendered framework for public pages. Profilo has three kinds of screens: public profile pages and the landing (must be server-rendered for link previews, SEO and no-JS — PUB-BR-7, PUB-BR-8), and a small owner panel (wizard, editor, account). All of them share the same design system and the public page renderer is reused in the editor preview.

## Decision

Build a single Next.js (App Router, React, TypeScript) application in `client/`:
- `/`, `/user/{nick}`, legal pages: server components rendered on each request, no data cache, so unpublishing is visible immediately (PRF-BR-17).
- `/panel/**`, `/rejestracja`, `/logowanie`: client components calling the API with a generated client.
- The public page component is shared by `/user/{nick}` and the editor preview.

Next.js is a rendering layer only: no business logic, no database access, no Next.js API routes. All data comes from the FastAPI backend.

## Consequences

- One frontend build, one design system implementation, one container.
- The preview is pixel-identical to the published page.
- Next.js server needs Node.js in production (one extra container next to the API).
