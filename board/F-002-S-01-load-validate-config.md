---
id: F-002-S-01
type: story
title: Load and validate .mos/config.json
status: Done
priority: P0
owner: mozart
sprint: S1
parent: F-002
estimate: S
dependsOn: [T-001]
created: 2026-06-07T13:00:00Z
updated: 2026-06-10T00:18:00Z
---

# F-002-S-01 — Load and validate .mos/config.json

Read the config, apply defaults for missing optional keys, and validate: every type's
states map to a real column or null; parent rules nest at most one level.

## Outcome

`packages/core` exposes `loadConfig(input) -> { config: VaultConfig; errors: string[] }`.
Given a well-formed config it returns a fully-typed object with defaults filled in; given a
broken one it returns the same shape with a non-empty `errors` array and never throws.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5–§6 — the type system and the
  `config.json` field list. The contract.
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) lines 71–81 — the exact
  type/state/parent validation rules already in use; port them faithfully.
- [`.mos/config.json`](../.mos/config.json) — the reference config to use as the "happy
  path" fixture.

## Constraints (must honor)

- Pure core: input is a JSON string or already-parsed object, never a path. No I/O. (ADR-001)
- No-throw public surface: malformed input → `errors`, not an exception.
- Config-driven: validate structure generically; don't special-case this repo's type names.

## Plan

1. Accept `string | object`; if string, `JSON.parse` inside a try and turn a parse failure
   into an error entry.
2. Apply defaults: missing `board.sortWithinColumn` → `["priority", "id"]`; missing
   `wiki.exclude` → `[]`; missing `sprints` → `[]`; missing `fields` → `{}` (all fields are
   `string`); missing `meta.timestamps` → `{ createdField: "created", updatedField:
   "updated" }`.
3. Validate: each `type.parent` is `null` or names a defined type whose own `parent` is
   `null` (nesting ≤ 1); each state maps to a column in `board.columns` or to `null`. For
   `fields`, validate each entry's `type` is known (`string`/`enum`/`id`/`date`/`datetime`)
   and that an `enum` has `values` or a resolvable `source`.
4. Return `{ config, errors }`; export from `index.ts`.

## Acceptance

- [x] A malformed config (bad JSON, unknown column, parent-of-a-parent) produces clear
      `errors` entries, not a crash.
- [x] A parent type pointing at a type that itself has a parent is rejected.
- [x] Optional keys absent from input come back as their documented defaults (including
      `fields` → all-string and `meta.timestamps` → `created`/`updated`).
- [x] An unknown field `type` or an `enum` without `values`/`source` is reported in `errors`.
- [x] Vitest covers the happy path plus each failure mode.

## Dependencies

- **Depends on:** T-001. **Blocks:** F-002-S-02, F-001-S-02.

## Out of scope

Reading the file from disk; the state→column *application* at render time (that's
F-002-S-02). This story is parse + validate only.

## References

ADR-001, ADR-003; `docs/05-VAULT_SPEC.md` §5–§6; `scripts/validate-vault.mjs`.
