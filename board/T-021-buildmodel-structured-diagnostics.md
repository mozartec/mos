---
id: T-021
type: task
title: Structured diagnostics for buildModel — kind, not path-bearing strings
status: Todo
priority: P3
phase: Phase 4
owner: mozart
dependsOn: [T-017]
touches: [core]
created: 2026-06-16T09:21:38Z
updated: 2026-06-16T09:21:38Z
---

# T-021 — Structured diagnostics for buildModel — kind, not path-bearing strings

[`buildModel`](../packages/core/src/models.ts) returns
`BuildModelResult.diagnostics: string[]`, with the file path **baked into each message**
(`${path}: not a card (unrecognized or missing type)`, `${path}: card has no id`,
`duplicate id '${id}' (${path})`). Consumers must string-match to tell the kinds apart —
[`validateVault`](../packages/core/src/validate.ts) forwards `card has no id` /
`duplicate id` but filters out `not a card`, which it does by matching buildModel's exact
message suffix (`NOT_A_CARD_SUFFIX`, added in T-017 after a loose `includes('not a card')`
was found to **swallow real errors** for any board file whose path contained that text).
That coupling to human-readable wording is the root; this task removes it.

## Outcome

- `BuildModelResult.diagnostics` is a list of structured entries — e.g.
  `{ kind: 'not-a-card' | 'no-id' | 'duplicate-id'; message: string; path: string }` — so
  consumers filter by `kind`, never by substring.
- `validateVault` surfaces `no-id` + `duplicate-id` by kind and drops `not-a-card`, and the
  `NOT_A_CARD_SUFFIX` exact-suffix match is gone.
- Every consumer and test is updated to the new shape.

## Context — read before starting

- [`packages/core/src/models.ts`](../packages/core/src/models.ts) — `buildModel` /
  `indexCard` / `applyFileChange` push the three string diagnostics; `BuildModelResult` is
  the public type to change.
- [`packages/core/src/validate.ts`](../packages/core/src/validate.ts) — the only **reader**
  of `.diagnostics` today (the `NOT_A_CARD_SUFFIX` filter); switch it to `kind`.
- [`packages/core/src/models.test.ts`](../packages/core/src/models.test.ts) and
  [`validate.test.ts`](../packages/core/src/validate.test.ts) — update fixtures/assertions.
- Other `buildModel` importers — the web views
  ([reader](../apps/web/src/views/reader/reader-view.ts),
  [board](../apps/web/src/views/board/board-view.ts),
  [graph](../apps/web/src/views/graph/graph-view.ts),
  [wiki](../apps/web/src/views/wiki/wiki-view.ts)) and
  [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — a grep shows none read
  `.diagnostics` today (they use `model`), but confirm and update any that destructure it.
- The future `mos validate` CLI (F-029) consumes the same result — keeping kinds structured
  helps it surface diagnostics cleanly.
- [ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database) — core is pure.

## Constraints (must honor)

- **Public-API change.** `BuildModelResult.diagnostics`'s element type changes; treat it as
  a breaking core change — update **every** consumer and test, and keep `message`/`path`
  available so a human-readable line is still trivial to render.
- **Behavior-preserving for the validator.** The same diagnostics are surfaced as errors
  (`no-id`, `duplicate-id`) and excluded (`not-a-card`) — only the matching mechanism
  changes. Keep `scripts/validate-vault.test.mjs` and `validate.test.ts` green (the
  surfaced error strings may be assembled from `message`).
- **Core stays pure (ADR-001).**

## Plan

1. Define the diagnostic kind union + entry type; change `BuildModelResult.diagnostics`.
2. Update `indexCard`/`applyFileChange` to push structured entries (carry `kind`, `path`,
   and the human `message`).
3. Update `validate.ts` to filter by `kind` and drop `NOT_A_CARD_SUFFIX`; assemble surfaced
   error strings from `message`.
4. Update `models.test.ts`, `validate.test.ts`, and any other consumer the grep finds.
5. Full gate (`bunx vitest run` directly in `packages/core` to dodge the cross-worktree cache).

## Acceptance

- [ ] `BuildModelResult.diagnostics` entries carry a `kind`; no consumer matches diagnostic
      wording by substring.
- [ ] `validateVault` surfaces `no-id`/`duplicate-id` and excludes `not-a-card` by `kind`;
      `NOT_A_CARD_SUFFIX` is removed.
- [ ] A board file whose path contains "not a card" still has its real error surfaced
      (the T-017 regression test stays green).
- [ ] All `buildModel` consumers compile and behave unchanged; full gate green.

## Dependencies

- **Depends on:** T-017 (this card removes `NOT_A_CARD_SUFFIX` and the suffix filter it
  added, and changes `models.ts` that T-017's `validate.ts` consumes). **Blocks:** nothing.

## Out of scope

The loadConfig field-def sanitization (T-020). New diagnostic **kinds** beyond the three
buildModel already emits.

## References

[`models.ts`](../packages/core/src/models.ts);
[`validate.ts`](../packages/core/src/validate.ts);
[`models.test.ts`](../packages/core/src/models.test.ts);
[ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database);
T-017; F-029.
