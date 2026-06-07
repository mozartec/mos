# Conventions

The style guide for this repo. It applies to the docs, the backlog cards, and the ADRs.
Because mos is a vault, these conventions are also a worked example of the format mos
reads.

## IDs

Stable, never reused once assigned:

- Features: `F-001`, `F-002`, …
- Stories (always under a feature): `F-001-S-01`, `F-001-S-02`, …
- Tasks (no user-facing UI change): `T-001`, `T-002`, …
- ADRs: `ADR-001`, … (sections in [`08-DECISIONS.md`](08-DECISIONS.md))

If something is dropped, set its status to `Dropped`/`Deferred` and leave the id reserved.

## Features vs tasks

- **Feature (`F-XXX`)** — a user does something differently when it ships. Has stories.
- **Task (`T-XXX`)** — the system/build does something differently, no user-facing change
  (scaffolding, CI, packaging, watcher). No stories.

## Card files

One card per file in `board/`, named `<id>-<short-slug>.md`. Required frontmatter: `id`,
`type`, `title`, `status`. See [`05-VAULT_SPEC.md`](05-VAULT_SPEC.md) §4 for all fields and
the allowed states per type.

```markdown
---
id: F-007
type: feature
title: Desktop app (Tauri)
status: Deferred
phase: Phase 2
priority: P2
owner: mozart
---

# F-007 — Desktop app (Tauri)

One paragraph: what changes for the user when this ships.

## Stories
F-007-S-01, F-007-S-02
```

Stories carry `parent: <feature-id>` and an `estimate` (XS–XL). Keep bodies short:
purpose, acceptance bullets, technical hints.

## Statuses

- Features/tasks: `Draft` → `Planned` → `In Progress` → `Done`; plus `Deferred`/`Dropped`
  (hidden from the board).
- Stories: `Todo` → `Planned` → `In Progress` → `Done`; plus `Blocked` (shown in In
  Progress with a badge).

## Priority and phase

- Priority: `P0` (MVP-critical) · `P1` (next) · `P2` (later) · `P3` (someday).
- Phase: `MVP` · `Phase 2` · `Future`.

## Docs

Top-level docs are `NN-NAME.md`; the number is sort order, not a stable id. Write in prose;
use tables for genuinely tabular content. Keep intent here and truth in code.

## ADRs

Append-only, in `08-DECISIONS.md`, using the Context / Decision / Consequences shape. To
change a decision, add a new ADR that supersedes the old one.

## What not to do

- Don't duplicate content across docs — link instead.
- Don't put decisions in feature cards — write an ADR and reference it.
- Don't maintain a separate status table that duplicates the board; the cards are truth.
