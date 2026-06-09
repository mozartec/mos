---
id: F-004-S-02
type: story
title: Card component showing type fields
status: Todo
dependsOn: [F-001-S-02, F-002-S-01]
created: 2026-06-07T13:00:00Z
updated: 2026-06-09T20:18:00Z
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

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §4 + §5a — the **contract this card
  implements**: a card shows its type's `card.fields`, each value typed by the `fields`
  registry. (Already decided at the spec level.)
- [`packages/core/src/models.ts`](../packages/core/src/models.ts) — the `Card` type. It
  currently holds only `id/type/title/status/path/priority?`; `buildModel` drops all other
  frontmatter. **This story extends it** (Plan step 1) so the face can show the declared
  fields — the deferred "extend the model when a lens needs it" step F-001-S-02 flagged.
- [`.mos/config.json`](../.mos/config.json) — the actual `card.fields` lists (feature/story/
  task differ; story shows `parent` and `estimate`) and the `fields` registry types.
- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Inside an app — dumb components
  live in `components/`.
- T-006 — Tabler icons + the project fonts/IDs in mono, when present (use icons for field
  glyphs and the blocked badge).

## Constraints (must honor)

- **Card carries its raw frontmatter as a generic map**, not named typed props: add
  `fields: Record<string, unknown>` (the parsed frontmatter values) to the core `Card` and
  populate it in `buildModel`. Keep it generic so rendering stays config-driven via the
  registry — never hardcode a `story has estimate` shape. (ADR-003; spec §4/§5a)
- Config-driven face: render the fields the type declares, in order; unknown/missing fields
  are simply omitted, never hardcoded. (ADR-003)
- **Type-aware rendering** (spec `0.2`, §5a): use the field registry's type to format each
  value — `datetime`/`date` as relative + absolute (e.g. "updated 19h ago", full ISO on
  hover), `enum` as a chip, `id` as a (later) link. A field with no registry entry renders as
  plain text. Missing `created`/`updated` are omitted without complaint (ADR-010).
- Dumb + reusable: inputs only, emit a `select` event; no data fetching, no writes. (ADR-002)
- Accessible: the card is keyboard-focusable and activatable (it opens the reader in S-04).

## Plan

1. **Core (small, in `packages/core`):** add `fields: Record<string, unknown>` to `Card`
   (`models.ts`) and populate it in `buildModel` from the parsed `file.data`. Add a unit test
   that a built card carries its frontmatter values.
2. Inputs to the component: the `Card` + its `TypeDef` (for `card.fields`) + the `fields`
   registry (`config.fields`) + a `blocked` flag.
3. For each key in `type.card.fields`, read `card.fields[key]` and render a labelled chip/row
   **formatted by its registry type**: `datetime`/`date` → relative + absolute (full ISO on
   hover); `enum` → chip; `id` → plain text now (link later); a missing key → omitted, no
   empty slot. Label from `config.fields[key].label`, falling back to the key.
4. Emit `select(card)` on click/Enter; make the host keyboard-focusable. Subtle accent class
   by type or priority; daisyUI badge when `blocked`. Tabler icons (T-006) for glyphs once
   present; render ids/timestamps in mono.
5. Lives in `apps/web/src/components/card/`.

## Acceptance

- [ ] The core `Card` carries its frontmatter as `fields`, populated by `buildModel` (with a
      test); the component reads field values from it.
- [ ] A card shows exactly the fields its type declares, in declared order.
- [ ] Datetime fields (`created`/`updated`) render relative + absolute; a card missing them
      shows no empty slot.
- [ ] A `Blocked` card shows the badge; others don't.
- [ ] The component takes inputs and emits a select event — no I/O inside it.

## Dependencies

- **Depends on:** F-001-S-02 (cards), F-002-S-01 (type field lists). Polishes with T-006.
- **Blocks:** F-004-S-04 (the select event opens the reader).
- Touches `packages/core` (`Card` + `buildModel`); among the current ready set only this card
  touches core, so it stays conflict-free. Shares a seam with F-004-S-01, which hosts this
  card in its columns — whoever lands second wires `<app-card>` into `board-view`.

## Out of scope

Column layout (F-004-S-01), filtering (F-004-S-03), navigation wiring (F-004-S-04). The card
face only.

## References

ADR-002, ADR-003; `docs/05-VAULT_SPEC.md` §4–§5; `.mos/config.json`.
