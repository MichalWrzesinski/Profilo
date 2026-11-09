# 0002. Draft in relational tables, published version as an immutable JSON snapshot

Status: accepted (2026-11-09)

## Context

The owner edits a draft that is autosaved continuously; visitors see only the last published version (PRF-BR-14, PRF-BR-15). Publication must copy all content atomically, including link order, layout and colour. Keeping two parallel sets of tables (draft and published) doubles the schema and every migration.

## Decision

- The draft lives in normal tables (`profiles`, `profile_links`, `images`) with constraints and a `version` column for optimistic locking.
- "Publish" serialises the draft into one validated JSON document (schema `PublishedProfileV1`) and stores it in `published_profiles.content` in the same transaction that sets `published_at`. The public endpoint reads only this snapshot.
- `has_unpublished_changes` = `profiles.draft_updated_at > published_profiles.published_at`.
- Images referenced by the snapshot are kept until no draft or snapshot references them (cleanup job).

## Consequences

- Public reads are a single-row lookup by nick; no joins.
- The snapshot has its own versioned schema; a breaking change requires a data migration of snapshots (expand/contract).
- Discarding draft changes (Later, Should) is a simple restore from the snapshot.
