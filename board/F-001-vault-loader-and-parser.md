---
id: F-001
type: feature
title: Vault loader and parser
status: Done
priority: P0
phase: MVP
owner: mozart
sprint: S1
dependsOn: [T-001, F-002]
created: 2026-06-07T13:00:00Z
updated: 2026-06-10T00:18:00Z
---

# F-001 — Vault loader and parser

Read a vault folder and turn its markdown into an in-memory model: files, frontmatter,
cards, and resolved references. This is the pure core every other feature builds on.

## Outcome

After this feature, `packages/core` turns a set of `{ path, text }` file contents (handed in
by a `VaultSource`) into a populated `VaultModel`: every file parsed into frontmatter + body,
cards keyed by `id`, each card's type known, and references in bodies resolved to their
target ids. The wiki and board lenses render entirely from this model. The placeholder
`VaultModel`/`createEmptyVaultModel` shipped in T-001 gets fleshed out here.

## Context — read before starting

- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Data flow — core receives file
  *contents* from the `VaultSource` and produces the model the UI renders; it never touches
  disk.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §3–§4, §7 — what qualifies as a card,
  the frontmatter fields, and the three reference forms to resolve.
- [`packages/core/src/models.ts`](../packages/core/src/models.ts) and
  [`vault-source.ts`](../packages/core/src/vault-source.ts) — the existing placeholder
  `Card`/`VaultModel` and the `VaultSource` interface to build against.
- F-002 — the `VaultConfig` that tells the model builder which `type`s are cards and how
  they behave.

## Constraints (must honor)

- **Pure core.** No `fs`, no network, no framework. Input is file contents already read by a
  `VaultSource`. (ADR-001)
- **Identity is the `id`, not the path** — resolution and keying are by id so renames don't
  break links. (ADR-003, VAULT_SPEC §7)
- **No-throw on bad input** — malformed frontmatter/duplicate ids are reported in the model,
  not thrown.

## Plan

Build the three stories in order: parse one file (S-01), assemble the model from many files
+ config (S-02), then resolve references across the model (S-03). Each is a pure function
with Vitest fixtures; export the public surface from `packages/core/src/index.ts`.

## Acceptance

- [x] `parseFile`, `buildModel`, and `resolveReferences` exist, are pure, and are exported.
- [x] Pointing the pipeline at this repo's `board/` + `docs/` reproduces the card set the
      interim `validate-vault.mjs` prints.
- [x] Zero framework / `fs` / network imports across the new core files.

## Stories

F-001-S-01, F-001-S-02, F-001-S-03

## Dependencies

- **Depends on:** T-001 (core package), F-002 (type system for S-02/S-03).
- **Blocks:** F-003 (wiki renders model files), F-004 (board renders model cards),
  F-005 (re-index re-runs this pipeline).

## Out of scope

Reading/watching files (the `VaultSource`, T-002/T-004), markdown-to-HTML rendering
(F-003-S-02), and board column layout (F-004). This feature stops at the in-memory model.

## References

ADR-001, ADR-003; `docs/03-ARCHITECTURE.md`, `docs/05-VAULT_SPEC.md`.
