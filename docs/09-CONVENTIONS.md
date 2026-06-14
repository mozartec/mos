---
created: 2026-06-07T13:00:00Z
updated: 2026-06-12T22:15:00Z
---

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
created: 2026-06-07T13:00:00Z
updated: 2026-06-07T13:00:00Z
---

# F-007 — Desktop app (Tauri)

One paragraph: what changes for the user when this ships.

## Stories
F-007-S-01, F-007-S-02
```

Stories carry `parent: <feature-id>` and an `estimate` (XS–XL). Keep bodies short:
purpose, acceptance bullets, technical hints.

Set `created` and `updated` (ISO 8601 datetime) when you create a card, and bump `updated`
on every frontmatter edit — the app never writes these (see §Timestamps below and
[`05-VAULT_SPEC.md`](05-VAULT_SPEC.md) §4a).

## Statuses

- Features/tasks: `Draft` → `Planned` → `In Progress` → `Done`; plus `Deferred`/`Dropped`
  (hidden from the board).
- Stories: `Todo` → `Planned` → `In Progress` → `Done`; plus `Blocked` (shown in In
  Progress with a badge).

When an agent finishes a card it sets `status` to Done **and** ticks the card's own `##
Acceptance` boxes — the only prose edit allowed once a card has **left its initial state**
(ADR-002; before then, see §Refinement). The ship-card skill's `ship_card.py <id> --finish`
does both (and bumps `updated`) deterministically, so it isn't skipped.

## Refinement (reshaping cards before they start)

The read-only rule (ADR-002) protects *decided* work from drift, but it would also forbid
the one upstream activity parallel planning needs: reshaping not-yet-started cards so
conflict-free batches exist to be picked. So there is a single, explicit exception
([ADR-022](08-DECISIONS.md#adr-022--backlog-refinement-may-reshape-cards-that-havent-left-their-initial-state)):

- **Refinement** is an explicitly invoked stage that applies **only to cards still in
  their type's *initial* state** — the first state the type declares in config (this
  vault: `Draft` for features/tasks, `Todo` for stories). For such a card an agent may
  rewrite prose, split it, create enabler cards, and set `touches`/`dependsOn`.
- The goal is two-fold: raise each card to the cold-start standard (§Card readiness)
  *and* reshape overlap clusters — cards that all pile onto one surface (§Areas & touches)
  — into a sequenced enabler plus disjoint leaves, so a real parallel batch exists.
- **The moment a card leaves its initial state it is decided**, and ADR-002 applies
  unchanged: frontmatter only, never rewrite its prose (the sole exception is ticking its
  own `## Acceptance` on ship, above). The boundary is a status check, so it's mechanical.
- Splits follow the hierarchy where the type allows children: an oversized card becomes a
  container with child cards ([ADR-019](08-DECISIONS.md#adr-019--subcards-children-are-the-boards-units)),
  not a scatter of siblings.
- Refinement **never** runs as a side effect of picking or shipping — only when asked. The
  packaged form is the [`refine-batch`](../skills/refine-batch/SKILL.md) skill.

## Priority and phase

- Priority: `P0` (MVP-critical) · `P1` (next) · `P2` (later) · `P3` (someday).
- Phase: `MVP` · `Phase 2` · `Phase 3` · `Phase 4` · `Future`.

## Areas & touches

`touches` declares the card's physical surface — the parts of the repo the work will
change — as a list of area names from `areas` in
[`.mos/config.json`](../.mos/config.json) (e.g. `touches: [core, docs]`). It is what
makes "can these cards run in parallel?" checkable. The semantics — missing vs `[]`,
batch math, what the validator checks — are spec, defined once in
[`05-VAULT_SPEC.md`](05-VAULT_SPEC.md) §5c
([ADR-021](08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)
has the rationale). The workflow rules:

- **Fill it at planning time** — when the card is created or refined, from the card's
  own Plan/Outcome, not from guesses.
- **Keep it honest when scope changes.** If executing a card honestly touches an area it
  doesn't declare, update `touches` (and bump `updated`) as part of that change — a stale
  declaration silently poisons batch planning.
- **Declare the work, not the bookkeeping.** Every shipped card flips its own status in
  `board/`; don't declare `board` for that — declare it only when the work itself edits
  cards (e.g. a backfill).
- **Writing the field is a claim** — declare `[]` only for genuinely surface-free work,
  and omit the field only while the surface isn't known yet (§5c defines how each is
  treated). `bun run validate` is the cheap check that every declared name resolves.

## Review findings

A review finding that isn't fixed in the PR doesn't live in the PR thread — threads
aren't memory. Give every finding exactly one disposition, recorded where the next
worker will actually read it:

- **Fix now** — in the same PR.
- **Record** — as a constraint or plan note on the card that will consume it
  (refinement of initial-state cards,
  [ADR-022](08-DECISIONS.md#adr-022--backlog-refinement-may-reshape-cards-that-havent-left-their-initial-state)),
  or a new card when none fits.
- **Accept** — with the rationale stated in the PR body.

[PR #49](https://github.com/mozartec/mos/pull/49) is the worked example: a
batch-diagnostics obligation became a constraint on the card that consumes it, an
ownership question became a plan note on the card that decides it, and the rest were
fixed or accepted in the PR.

## Timestamps

Cards (and docs, where present) carry `created` and `updated` — ISO 8601 datetimes, UTC
(e.g. `2026-06-08T09:00:00Z`). They live in frontmatter, not git, because history is
rewritten and a vault must read as plain files without git (ADR-010). The rules:

- On **create**, set both `created` and `updated` to now.
- On **any frontmatter edit**, bump `updated` to now; leave `created` untouched.
- Always **UTC with a `Z` suffix** (`2026-06-08T09:00:00Z`) — never a local time or `+hh:mm`
  offset. `bun run validate` enforces this and fails on a non-UTC timestamp.
- The app **reads** them (relative + absolute display, optional sort) but **never writes**
  them — maintenance is the agent's job (ADR-002).
- They're **optional**: a doc or card without them is still valid; nothing breaks.

Field names are configurable per vault via `meta.timestamps`; the types come from the
`fields` registry. See [`05-VAULT_SPEC.md`](05-VAULT_SPEC.md) §4a (timestamps) and §5a
(field types).

## Docs

Top-level docs are `NN-NAME.md`; the number is sort order, not a stable id. Write in prose;
use tables for genuinely tabular content. Keep intent here and truth in code.

## Links

Write internal links as **plain relative markdown paths** — `[spec](05-VAULT_SPEC.md)`
from a sibling, `[architecture](../docs/03-ARCHITECTURE.md)` across folders — exactly what
GitHub renders. The same file then navigates on GitHub *and* in mos
([`05-VAULT_SPEC.md`](05-VAULT_SPEC.md) §7); no mos-specific syntax exists, so never
invent one. Bare id mentions (`F-001`) also resolve and survive renames — prefer them
when referring to a card rather than a specific file.

## ADRs

Append-only, in `08-DECISIONS.md`, using the Context / Decision / Consequences shape. To
change a decision, add a new ADR that supersedes the old one.

## What not to do

- Don't duplicate content across docs — link instead.
- Don't put decisions in feature cards — write an ADR and reference it.
- Don't maintain a separate status table that duplicates the board; the cards are truth.

## Card readiness (the cold-start standard)

The point of this whole repo is that **the files are the memory**. A new AI session — on
any model, including cheaper ones — should be able to land, read `AGENTS.md`, open a card,
and execute it without prior context and without guessing. So:

> **Definition of ready:** a card is ready to assign only when a cold mid-tier agent can
> complete it from the card file plus the documents the card links. If it can't, the card
> isn't ready — add the missing context, don't rely on the agent inferring it.

This is the work-unit equivalent of "a story you can't estimate isn't specified enough."
[`board/T-001`](../board/T-001-project-scaffold.md) is the reference example.

### Expanded card template

Beyond the frontmatter, a workable card body has these sections (skip ones that genuinely
don't apply, e.g. a tiny fix):

```markdown
## Outcome
One paragraph: what is true after this card is done that wasn't before.

## Context — read before starting
The exact docs/ADRs to read, each with a one-line why. Not "read the docs."

## Constraints (must honor)
The rules this card must not violate, one line each, with ADR links
(pure core, read-only, config-driven, etc.).

## Plan
Concrete ordered steps — commands, target file/folder structure, decisions already made.

## Acceptance
A checkbox list that defines done.

## Dependencies
Depends on: … / Blocks: …
(`dependsOn` in frontmatter is the machine-readable source; this prose section adds
context a script can't capture, e.g. why the dependency exists.)

## Out of scope
What NOT to touch — this is where cold agents overreach.

## References
ADRs and docs.
```

### Why layered, not dumped

Keep `AGENTS.md` small (a map), durable knowledge in `docs/`, and task-specific context in
the card. A cold agent then reads the entry point plus only the few documents its card
points to — never the whole history. That keeps cheaper models on-rails and keeps token
cost bounded. The information architecture mirrors the code architecture: a small entry,
pure references.
