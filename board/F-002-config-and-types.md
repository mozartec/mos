---
id: F-002
type: feature
title: Config and card types
status: Done
dependsOn: [T-001]
created: 2026-06-07T13:00:00Z
updated: 2026-06-09T20:18:00Z
phase: MVP
priority: P0
owner: mozart
sprint: S1
---

# F-002 — Config and card types

Load and validate `.mos/config.json`, and expose the type system (states, parent rules,
displayed fields, columns) so the board is driven entirely by config, never hardcoded.

## Outcome

After this feature, `packages/core` can take the raw text of a vault's `.mos/config.json`
and return a validated, typed `VaultConfig` object — or a clear list of errors if the
config is malformed. Every later feature (model building, the board layout, the card face)
reads the type system from this object instead of hardcoding `feature`/`story`/`task`,
columns, or states. This is the mechanism that makes ADR-003 real: "is this a card?" and
"how does it behave?" both come from config. As of spec `0.2` the config also carries an
optional **field-types registry** (`fields`) and a **`meta.timestamps`** block; this feature
loads and exposes both so later features can render/sort typed fields (dates, enums, ids) and
locate the `created`/`updated` fields by their configured names (ADR-010).

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5–§6 — the type system (states →
  column, one-level `parent` rule, `card.fields`) and the exact `config.json` shape this
  feature parses. This is the data contract; follow it literally.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-003 (a card is folder scope + a
  recognized `type`; config drives behavior) and ADR-001 (folder is source of truth, core
  is pure).
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — the interim validator
  already encodes the rules this feature must enforce (parent nesting ≤ 1, states map to a
  real column or `null`). Treat it as the executable spec; this feature graduates that
  logic into typed, tested core code.
- [`.mos/config.json`](../.mos/config.json) — the live config this repo uses; your fixtures
  should mirror its shape.

## Constraints (must honor)

- **Pure core only.** Lives in `packages/core`; no `fs`, no network, no framework — it
  parses a string the caller already read. (ADR-001)
- **Config-driven, never hardcoded.** Do not bake in `feature`/`story`/`task`, the four
  columns, or any state name. Everything comes from the parsed object. (ADR-003)
- **Errors are returned, not thrown** past the public function — a malformed config yields a
  result with an error list, never an uncaught exception (mirrors `parseFrontmatter`'s
  no-throw contract in F-001-S-01).

## Plan

1. Define `VaultConfig` types in `packages/core/src/config.ts` matching VAULT_SPEC §6
   (`vault`, `wiki`, `board.columns`, `board.sortWithinColumn`, `types[*].states`,
   `types[*].parent`, `types[*].card.fields`, `sprints`), plus the spec-`0.2` additions:
   `fields` (the typed field registry, §5a), `meta.timestamps`, and `wiki.fields`. All three
   are optional — absent `fields` means every field is `string`; absent `meta.timestamps`
   defaults the names to `created`/`updated`.
2. Implement F-002-S-01: `loadConfig(json: string | object) -> { config; errors }` with
   defaults for optional keys and the validation rules below.
3. Implement F-002-S-02: a pure `columnForCard(card, config)` helper plus a visibility flag,
   so a card's type + status resolves to a column (or "hidden").
4. Export both from `packages/core/src/index.ts`; add Vitest fixtures (a good config, plus
   malformed ones) under `packages/core/src/`.

## Acceptance

- [x] A valid config parses into a typed `VaultConfig`; optional keys get documented
      defaults.
- [x] Every validation rule the interim `validate-vault.mjs` enforces is covered by a core
      test (unknown column, nesting > 1, undefined parent type).
- [x] A card's `(type, status)` maps to the right column, with `Deferred`/`Dropped` hidden
      and `Blocked` → `In Progress`.
- [x] The `fields` registry and `meta.timestamps` load with defaults when absent; an
      unlisted field is treated as `string`; field-value type checks are best-effort
      diagnostics, never fatal.
- [x] Zero framework / `fs` / network imports in the new files.

## Stories

F-002-S-01, F-002-S-02

## Dependencies

- **Depends on:** T-001 (core package exists).
- **Blocks:** F-001-S-02 (model build needs the type system), F-004 (board layout reads
  columns + mapping from here).

## Out of scope

Reading the file from disk (that's the `VaultSource`/T-002), the id-shape regex used for
reference resolution (F-001-S-03 owns that), and any UI. This feature is types + pure
functions only.

## References

ADR-001, ADR-003; `docs/05-VAULT_SPEC.md` §5–§6; `scripts/validate-vault.mjs`.
