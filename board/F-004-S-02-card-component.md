---
id: F-004-S-02
type: story
title: Card component showing type fields
status: Todo
created: 2026-06-07T13:00:00Z
updated: 2026-06-07T13:00:00Z
priority: P0
owner: mozart
sprint: S2
parent: F-004
estimate: S
---

# F-004-S-02 — Card component showing type fields

A card showing the fields its type declares in `card.fields` (id, title, priority, owner,
sprint, etc.), a blocked badge when relevant, and a subtle color by type or priority.

## Outcome

A reusable presentational card component renders one card's face: its title plus exactly the
fields its type lists in `type.card.fields` (in that order), a `Blocked` badge when the
card's placement says so, and a subtle accent by type or priority. It's a dumb component —
data in, click event out — living in `apps/web/src/components/`.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §4–§5 — `card.fields` per type and the
  `Blocked` badge rule.
- [`.mos/config.json`](../.mos/config.json) — the actual `card.fields` lists (feature/story/
  task differ; story shows `parent` and `estimate`).
- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Inside an app — dumb components
  live in `components/`.
- T-006 — Tabler icons + the project fonts/IDs in mono, when present (use icons for field
  glyphs and the blocked badge).

## Constraints (must honor)

- Config-driven face: render the fields the type declares, in order; unknown/missing fields
  are simply omitted, never hardcoded. (ADR-003)
- **Type-aware rendering** (spec `0.2`, §5a): use the field registry's type to format each
  value — `datetime`/`date` as relative + absolute (e.g. "updated 19h ago", full ISO on
  hover), `enum` as a chip, `id` as a (later) link. A field with no registry entry renders as
  plain text. Missing `created`/`updated` are omitted without complaint (ADR-010).
- Dumb + reusable: inputs only, emit a `select` event; no data fetching, no writes. (ADR-002)
- Accessible: the card is keyboard-focusable and activatable (it opens the reader in S-04).

## Plan

1. Inputs: the card + its type definition (for `card.fields`) + a `blocked` flag.
2. Render title + each declared field as a labelled chip/row, **formatted by its registry
   type** (datetimes relative+absolute, enums as chips); show a daisyUI badge when `blocked`;
   apply a subtle accent class by type or priority.
3. Emit `select(card)` on click/Enter. Use Tabler icons for field glyphs once T-006 lands;
   render ids and timestamps in the mono font.

## Acceptance

- [ ] A card shows exactly the fields its type declares, in declared order.
- [ ] Datetime fields (`created`/`updated`) render relative + absolute; a card missing them
      shows no empty slot.
- [ ] A `Blocked` card shows the badge; others don't.
- [ ] The component takes inputs and emits a select event — no I/O inside it.

## Dependencies

- **Depends on:** F-001-S-02 (cards), F-002-S-01 (type field lists). Polishes with T-006.
- **Blocks:** F-004-S-04 (the select event opens the reader).

## Out of scope

Column layout (F-004-S-01), filtering (F-004-S-03), navigation wiring (F-004-S-04). The card
face only.

## References

ADR-002, ADR-003; `docs/05-VAULT_SPEC.md` §4–§5; `.mos/config.json`.
