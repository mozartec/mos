---
id: T-017
type: task
title: Graduate the vault validator into packages/core (spec-version aware)
status: Done
priority: P2
phase: Phase 4
owner: mozart
touches: [core, scripts]
created: 2026-06-14T18:29:34Z
updated: 2026-06-15T14:48:53Z
---

# T-017 — Graduate the vault validator into packages/core (spec-version aware)

[`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) is a standalone script that
**inlines its own parser and placement logic**, duplicating what
[`packages/core`](../packages/core/src/index.ts) already does for real (`parseFile`,
`placeCard`, `resolveReferences`, `resolveTouches`, scope). Its header still promises
*"When packages/core lands (F-002), this logic graduates into core"* — F-002 is **Done**
and it never did; that comment is now misleading doc-rot. This task closes the loop: move
the validation **checks** onto core's API, implement the spec's
[§0](../docs/05-VAULT_SPEC.md) promise that "the app states which spec versions it
supports," and reduce the script to a thin I/O shell.

## Outcome

- `packages/core` exports a single, **pure** `validateVault` built on core's own
  parser/config/placement, replacing the script's inlined duplicate parser.
- The validator declares the spec-version range it covers and emits a **non-fatal warning**
  when a vault's `specVersion` is newer than that range; equal/older vaults validate
  unchanged (evolution is additive — §0).
- `scripts/validate-vault.mjs` and `bun run validate` keep working as a thin shell over
  core; the contract suite `scripts/validate-vault.test.mjs` stays green — updated only where
  the real parser legitimately changes a diagnostic, with the diff explained.
- The stale F-002 graduation comment is replaced with an accurate description.

## Context — read before starting

- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — the current standalone
  validator: its `validateVault`, `printReport`, `discover`, and the inlined
  parser/placement to remove; the header comment to fix.
- [`packages/core/src/index.ts`](../packages/core/src/index.ts) — the exports to build on:
  `parseFile`, `loadConfig`, `buildModel`, `placeCard`, `resolveReferences`,
  `resolveTouches` / parallel helpers, and the scope helpers.
- [`packages/core/src/config.ts`](../packages/core/src/config.ts) — `loadConfig` already
  validates config shape and reads `specVersion`; the supported-range logic belongs here or
  beside the new validator.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §0 — spec versioning: the app "states
  which spec versions it supports," and evolution is **purely additive** (an older vault
  with none of the new keys stays valid).
- [`docs/11-RELEASING.md`](../docs/11-RELEASING.md) — when `specVersion` is bumped and how
  `mos init` stamps it.
- T-011 (Done — card frozen, ADR-002) — shipped the validator contract suite
  [`scripts/validate-vault.test.mjs`](../scripts/validate-vault.test.mjs) and explicitly
  scoped this core-port out as *future*. This task edits that **suite file** (not the card),
  keeping it green or updating fixtures with each diff justified.
- T-012, T-016, F-024 — the checks the validator performs today (area-glob overlap,
  malformed-area shape, `touches` resolution) that must survive the move.
- [ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)
  — **core is pure**: no filesystem/network in `packages/core`.

## Constraints (must honor)

- **Core stays pure (ADR-001).** The graduated `validateVault` operates on already-parsed
  cards + a loaded config and returns `{ errors, warnings }`. All file reading, vault
  discovery, and printing stay in the I/O shell (the script, and later the CLI). Add no
  `node:fs`/`node:path`/network imports to core — mirror how `parseFile` is pure over a
  string while I/O lives in the apps.
- **Behavior-preserving — enumerate and verify.** Every check the script performs today
  survives: type→column mapping, parent nesting ≤ 1, scope dates, list-enum allowed values,
  `dependsOn`/`parent` id resolution, UTC timestamps, area-glob overlap (T-012),
  malformed-area shape (T-016), `touches` resolution (F-024). Prove each with a fixture;
  T-011 staying green is the backstop.
- **Spec-version check is additive-safe.** Warn **only** when `specVersion` is *newer* than
  the supported range; equal/older stays silent. Never error on version alone — it's
  advisory, because the format is forward-additive (§0).
- **Stable surface for 0.4.** `bun run validate` output and exit codes are unchanged for
  current (spec 0.4) vaults.

## Plan

1. Add a pure validator to core (e.g. `packages/core/src/validate.ts`):
   `validateVault(parsedCards, config) → { errors, warnings }`, reusing `placeCard`,
   `resolveReferences`, `resolveTouches`, scope, and the existing config checks. Export it
   from `index.ts`. No fs imports.
2. Add supported-spec handling: core declares the spec range it covers (a constant/range);
   push a warning when `config.specVersion` is newer. Keep equal/older silent.
3. Reduce `scripts/validate-vault.mjs` to the I/O shell — read files + discover vaults as
   today, call core's `parseFile` + `validateVault`, keep `printReport` — and delete the
   inlined parser/placement now living in core.
4. **Run the local gate under `bun`.** `@mos/core` is consumed as TS source
   (`exports: ./src/index.ts`, no `dist/`, a `yaml` dep), so plain `node` can't import it —
   and that's fine: this is a bun monorepo (ADR-008) where `bun install` is a given. Flip the
   root script to `"validate": "bun scripts/validate-vault.mjs"`; CI's `bun run validate`
   call site (ci.yml) is unchanged. The script stays the I/O shell and imports `@mos/core`'s
   `validateVault`. (The adopter/any-repo path is `mos validate` — F-029 — over the same core
   function.)
5. Update the validator contract suite `scripts/validate-vault.test.mjs` (the file T-011
   shipped; the T-011 card stays Done and untouched) and move `test:scripts` off
   `node --test` to bun's runner, since the script-under-test now imports core TS. This
   **supersedes T-011's deliberate zero-dep/plain-node test choice** — call that out in the
   PR. Preserve the report format where possible; where core's real parser changes a
   diagnostic, update the fixture and state why.
6. Replace the stale header comment with an accurate one (validation lives in core; the
   script is the I/O entry; `mos validate` surfaces it — F-029).

## Acceptance

- [x] `packages/core` exports a pure `validateVault` over parsed input + config; it imports
      no `node:fs`/`node:path`/network (core stays pure — ADR-001).
- [x] The script's inlined parser/placement is removed; `scripts/validate-vault.mjs` only
      reads/discovers/prints and delegates the checks to core.
- [x] Every check listed in Constraints still fires (one fixture per check); the contract
      suite `scripts/validate-vault.test.mjs` stays green or is updated with each diff
      explained.
- [x] A vault whose `specVersion` is newer than the supported range produces a non-fatal
      warning; an equal/older vault does not.
- [x] `bun run validate` on this repo is clean; exit codes are unchanged for valid/invalid
      0.4 vaults.
- [x] The stale F-002 graduation comment is gone, replaced by an accurate description.

## Dependencies

- **Depends on:** nothing (foundational). **Blocks:** F-029 (the CLI command imports core's
  `validateVault`).

## Out of scope

The `mos validate` CLI command (F-029), the skills rewrite (T-018), any new validation
rules beyond spec-version awareness, and reshaping the report's human-readable format
beyond what the core move requires.

## References

[`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs);
[`packages/core/src/index.ts`](../packages/core/src/index.ts);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §0;
[`docs/11-RELEASING.md`](../docs/11-RELEASING.md);
[ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database);
T-011; T-012; T-016; F-024.
