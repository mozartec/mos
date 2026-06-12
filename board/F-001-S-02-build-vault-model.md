---
id: F-001-S-02
type: story
title: Build the in-memory vault model
status: Done
priority: P0
owner: mozart
parent: F-001
estimate: M
dependsOn: [F-001-S-01, F-002-S-01]
created: 2026-06-07T13:00:00Z
updated: 2026-06-12T18:30:00Z
---

# F-001-S-02 — Build the in-memory vault model

From a set of parsed files, assemble the vault model: docs, cards (by id), and the type
of each card. Pure function: `buildModel(files, config) -> Model`.

## Outcome

`packages/core` exposes `buildModel(parsedFiles, config) -> VaultModel` (plus a list of
diagnostics). It walks the parsed files, decides which are cards (board-scope path + a
recognized `type`, per ADR-003), keys cards by `id`, records each card's type, and lists all
wiki files. Duplicate ids and board-scope files with no recognized type are reported, not
dropped. This fills out the placeholder `VaultModel` from T-001.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §3 — the "what qualifies as a card"
  rule (board glob + recognized `type`); §4 for required fields.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-003 (folder scope + `type` = card;
  surface unrecognized files rather than hide them).
- [`packages/core/src/models.ts`](../packages/core/src/models.ts) — the `Card`/`VaultModel`
  shape to extend (add what the lenses need; keep it minimal).
- F-002-S-01 (`VaultConfig`) and F-001-S-01 (`parseFile` output) — the two inputs.

## Constraints (must honor)

- Pure core, config-driven: card-ness is decided from `config.board.include` globs +
  `config.types`, never hardcoded prefixes. (ADR-001, ADR-003)
- Report, don't crash: duplicate ids and "not a card" files become diagnostics.

## Plan

1. For each parsed file, test its path against `board.include`; if in scope and `data.type`
   is in `config.types`, treat as a card, else as a wiki doc.
2. Validate a card has an `id`; key cards in `model.cards` by id; on a duplicate, push a
   diagnostic and keep the first.
3. Populate `model.files` (all wiki-scope paths). Return `{ model, diagnostics }`.
4. Vitest: a mixed fixture set (cards, a doc, a typed-but-bad file, a duplicate id).

## Acceptance

- [x] Cards are keyed by `id`; duplicate ids are reported.
- [x] Files in board scope without a recognized type are flagged "not a card", not dropped.
- [x] Running it over this repo's files matches `validate-vault.mjs`'s card count.

## Dependencies

- **Depends on:** F-001-S-01, F-002-S-01. **Blocks:** F-001-S-03, F-003, F-004.

## Out of scope

Reference resolution (F-001-S-03), column placement (F-002-S-02), rendering. Model assembly
only.

## References

ADR-001, ADR-003; `docs/05-VAULT_SPEC.md` §3–§4.
