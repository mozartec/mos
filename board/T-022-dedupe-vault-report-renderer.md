---
id: T-022
type: task
title: Dedupe the vault-report renderer shared by `mos validate` and `bun run validate`
status: Done
priority: P3
phase: Phase 4
owner: mozart
dependsOn: [F-029]
touches: [core, cli, scripts]
created: 2026-06-16T12:01:40Z
updated: 2026-07-02T09:45:38Z
---

# T-022 — Dedupe the vault-report renderer shared by `mos validate` and `bun run validate`

F-029 added [`apps/cli/src/validate.ts`](../apps/cli/src/validate.ts) as a thin I/O shell
over core's `validateVault`, deliberately mirroring the report
[`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) prints so `mos validate` and
`bun run validate` read identically (verified byte-identical in PR #67). The validation
*rules* are shared — both call core's one `validateVault` — but the *report assembly + string
formatting* is now duplicated: `validateVaultAt`/`formatVaultReport` in the CLI and
`validateVault(root)`/`printReport` in the script each hold a copy. A format change must land
in both, and they can silently drift — the exact "two copies in step" rot
[ADR-007](../docs/08-DECISIONS.md#adr-007--the-repository-is-the-memory-cards-target-cold-any-model-agents)
and T-019 otherwise stamp out.

## Outcome

- One source for the vault-report **assembly** (board layout, hidden/off-board, counts,
  errors + warnings) and **string rendering**, consumed by both `mos validate` and
  `scripts/validate-vault.mjs`; neither keeps a private copy.
- The report stays **byte-identical** to today's — the F-029 parity check (`mos validate` vs
  `bun run validate`) still passes.
- Core stays pure (ADR-001): the deduped piece does no I/O — it takes parsed data + config and
  returns report data / a string. File discovery and reading stay in each entry point's own
  (small) I/O layer.

## Context — read before starting

- [`apps/cli/src/validate.ts`](../apps/cli/src/validate.ts) — `validateVaultAt` (assembly) +
  `formatVaultReport` (rendering); the CLI copy (F-029).
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — `validateVault(root)`
  (assembly) + `printReport` (rendering); the script copy. Runs via Bun over core's TS source
  (no dist —
  [ADR-008](../docs/08-DECISIONS.md#adr-008--monorepo-with-bun-workspaces--turbo-not-nx)), so
  whatever both import must resolve that way as well as in the published CLI bundle.
- [`packages/core/src/validate.ts`](../packages/core/src/validate.ts) — core's pure
  `validateVault(build, config, paths) → {errors, warnings}`; `placeCard`/`sortWithinColumn`
  already live in core and are what the board layout reuses.
- [ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)
  — core is pure (a string/object in, a typed result out; no fs). The report assembly and the
  formatter are pure functions of data, so they *can* live in core — but decide whether
  presentation belongs there (see Decision).

## Decision (resolve before building)

Where the shared renderer lives. Both candidates keep core pure (the formatter does no I/O):

- **(A) Pure functions in `@mos/core`** — e.g. `buildValidationReport(build, config, paths)`
  (the display data: board layout, hidden, counts, errors + warnings) and
  `formatValidationReport(report)` (the text). Both entry points shrink to
  read → parse → buildModel → call these → print. Kills the most duplication; cost: core gains
  a presentation-flavoured function.
- **(B) A shared module outside core** that both import (CLI-owned, or a tiny internal
  package), keeping presentation out of core; cost: the repo script then depends on the CLI
  app's source — a new import edge.

Recommend **(A)** — the functions are genuinely pure and it removes the drift at the root;
raise it if "core renders a report" feels wrong.

## Constraints (must honor)

- **Core stays pure (ADR-001)** — no fs/network in the shared piece; I/O (walk/discover/read)
  stays in each entry point.
- **One validator, unchanged** — this is presentation/orchestration dedup only; core's
  `validateVault` rules and the `config:`-error filtering semantics don't change.
- **Byte-identical output** — the per-vault report block and the run summary stay exactly as
  today; the F-029 parity diff still passes.
- **Exit-code contracts preserved** — CLI 0 clean / 1 errors / 2 no vault, and the script's
  existing codes.

## Plan

1. Pick the placement (Decision).
2. Extract the report assembly (board layout via core's `placeCard`/`sortWithinColumn` +
   counts/hidden) and the string renderer into the shared home, with the report data type.
3. Rewire `apps/cli/src/validate.ts` and `scripts/validate-vault.mjs` to call it; delete both
   private copies.
4. Tests: keep the CLI `validate.test.ts` green and `scripts/validate-vault.test.mjs` green;
   add a unit test for the shared renderer (a fixed report → expected string); re-run the
   F-029 parity diff.
5. Full gate.

## Acceptance

- [x] The vault-report assembly + string renderer exist in exactly one place;
      `apps/cli/src/validate.ts` and `scripts/validate-vault.mjs` both consume it and hold no
      private copy.
- [x] `mos validate <dir>` output is byte-identical to `bun run validate` for the same vault
      (the F-029 parity check) and unchanged from today.
- [x] Core stays pure — the shared piece does no I/O; `bun run lint && test && build &&
      validate` green, plus `bun run test:scripts`.
- [x] Exit codes preserved (CLI 0/1/2; script unchanged); existing `validate.test.ts` and
      `validate-vault.test.mjs` pass.

## Dependencies

- **Depends on:** F-029 (introduced the CLI copy this dedupes against the script).
  **Blocks:** nothing.

## Out of scope

New validation rules or any report content/format change (this is a pure dedup — output is
unchanged); deduping the file-discovery/walk I/O if the chosen placement keeps that
per-entry-point; and any change to core's `validateVault` contract.

## References

[`apps/cli/src/validate.ts`](../apps/cli/src/validate.ts);
[`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs);
[`packages/core/src/validate.ts`](../packages/core/src/validate.ts);
[ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database);
[ADR-008](../docs/08-DECISIONS.md#adr-008--monorepo-with-bun-workspaces--turbo-not-nx); F-029.
