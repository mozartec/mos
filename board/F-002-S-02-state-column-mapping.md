---
id: F-002-S-02
type: story
title: Apply the type state-to-column mapping
status: Todo
priority: P0
owner: mozart
sprint: S2
parent: F-002
estimate: M
---

# F-002-S-02 — Apply the type state→column mapping

Given a card, compute its board column from its type's `states` map. States mapped to null
are hidden; multiple states may share a column.

## Outcome

`packages/core` exposes a pure helper — e.g. `placeCard(card, config) -> { column: string |
null; blocked: boolean }` — that the board layout (F-004) and the validator's successor use
to decide where a card goes. `column: null` means "valid status, off the board."

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5 — states map to a column or `null`;
  multiple states may share a column; `Blocked` → `In Progress` with a badge.
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) lines 111–134 — the existing
  placement + sort logic to port (priority rank then id).
- F-002-S-01 — the `VaultConfig` this consumes.

## Constraints (must honor)

- Pure core, no I/O, config-driven: the mapping comes entirely from `type.states`. (ADR-001,
  ADR-003)
- A status not present in the type's `states` is a data error surfaced upward, not a silent
  drop.

## Plan

1. Look up the card's type in `config.types`; read `states[card.status]`.
2. Return `column` (string or `null`) and `blocked = card.status === "Blocked"` (or, more
   generally, a configurable blocked flag — for MVP, the literal `Blocked` state).
3. Provide a companion `sortWithinColumn(cards, config)` matching the validator's rank
   (`priority` then `id`).

## Acceptance

- [ ] A `Deferred`/`Dropped` card returns `column: null` (excluded from the board).
- [ ] A `Blocked` story returns `column: "In Progress"` and `blocked: true`.
- [ ] Two states sharing a column both resolve to it.
- [ ] An unknown status is reported, not silently placed.

## Dependencies

- **Depends on:** F-002-S-01. **Blocks:** F-004-S-01 (render columns).

## Out of scope

Rendering, DOM, sprint filtering (F-004-S-03), and the card face (F-004-S-02). Pure
placement logic only.

## References

ADR-001, ADR-003; `docs/05-VAULT_SPEC.md` §5; `scripts/validate-vault.mjs`.
