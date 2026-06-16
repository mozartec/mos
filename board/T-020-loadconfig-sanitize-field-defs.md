---
id: T-020
type: task
title: Sanitize invalid field defs in loadConfig — FieldDef stops being a runtime lie
status: Todo
priority: P2
phase: Phase 4
owner: mozart
dependsOn: [T-017]
touches: [core]
created: 2026-06-16T09:21:38Z
updated: 2026-06-16T09:21:38Z
---

# T-020 — Sanitize invalid field defs in loadConfig — FieldDef stops being a runtime lie

[`loadConfig.normalize`](../packages/core/src/config.ts) casts `obj['fields']` to
`Record<string, FieldDef>` **without validating each entry**, so a non-object value
(e.g. `"fields": { "estimate": null }`) survives into `config.fields`. Every consumer
that then reads `def.type` / `def.list` / `def.values` unguarded crashes on it. T-017
patched the **validator** defensively (PR #65 added `isObject` guards to
`buildListEnumAllowed`, the id-list loop, and `validateScope`), but that is a symptom
fix — the root is that `loadConfig` lets a malformed def through, so `filters.ts`,
`scope.ts`, and `place-card.ts` may still throw. This task fixes it at the source.

## Outcome

- `loadConfig.normalize` drops (or coerces) any `fields` entry that isn't an object, so
  `config.fields` is a genuine `Record<string, FieldDef>` of real objects — the type
  stops lying about its runtime shape.
- The diagnostic policy for a dropped def is decided and documented: either keep
  `loadConfig.validate`'s existing `field X: unknown type` error or drop it with the entry.
- The defensive `as Record<string, unknown>` + `isObject` guards T-017 added to
  [`validate.ts`](../packages/core/src/validate.ts) can be simplified now that defs are
  guaranteed objects (do it here or note it for a follow-up).

## Context — read before starting

- [`packages/core/src/config.ts`](../packages/core/src/config.ts) — `normalize()` casts
  `fields` as-is; `validate()` already reads each def defensively
  (`isObject(fieldRaw) ? fieldRaw : {}`) and emits `field X: unknown type`. The lie is in
  `normalize`, which keeps the raw value.
- [`packages/core/src/config.test.ts`](../packages/core/src/config.test.ts) — the
  loadConfig contract tests to extend (add a non-object field def case).
- [`packages/core/src/validate.ts`](../packages/core/src/validate.ts) — the guards T-017
  added precisely because a null def could survive; relax them once the root is fixed.
- Field-def consumers to confirm don't crash on a sanitized config:
  [`filters.ts`](../packages/core/src/filters.ts) (`buildFacets`),
  [`scope.ts`](../packages/core/src/scope.ts) (`enumValueEntries`),
  [`place-card.ts`](../packages/core/src/place-card.ts) (`getPriorityRank`).
- [ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)
  — core is pure (a JSON string/object in, a typed result out; no I/O).

## Constraints (must honor)

- **Core stays pure (ADR-001)** — no I/O; a JSON string/object in, a typed result out.
- **The behavior change is deliberate.** A malformed field def disappears from
  `config.fields`; pick the diagnostic policy (keep vs drop `field X: unknown type`),
  state it in the PR, and update `config.test.ts` to match.
- **Only invalid entries change.** A valid field def's shape and the filled defaults are
  untouched.
- **Stable surface.** `bun run validate` output for this repo's (valid) vault is unchanged.

## Plan

1. In `normalize()`, keep only object entries of `obj['fields']` (e.g.
   `Object.fromEntries(Object.entries(raw).filter(([, v]) => isObject(v)))`), or coerce —
   decide.
2. Decide the dropped-def diagnostic policy; keep `validate()`'s messages consistent.
3. Extend `config.test.ts` with a non-object field def case asserting the chosen behavior.
4. Simplify (or note) the T-017 guards in `validate.ts` now that defs are object-guaranteed.
5. Run the full gate (`bunx vitest run` directly in `packages/core` to dodge the
   cross-worktree turbo cache).

## Acceptance

- [ ] A config with a non-object field def (e.g. `fields:{x:null}`) loads with that entry
      absent from `config.fields`; no core consumer crashes reading it.
- [ ] The dropped-def diagnostic policy is decided and pinned by a `config.test.ts` case.
- [ ] Valid configs are unchanged (defaults + valid defs intact); `bun run validate` output
      for this repo is byte-for-byte the same.
- [ ] Full gate green: `bun run lint && bun run test && bun run build && bun run validate`
      plus `bun run test:scripts`.

## Dependencies

- **Depends on:** T-017 (this card relaxes the validator guards T-017 added and shares
  `validate.ts`; sequencing avoids a merge conflict). **Blocks:** nothing.

## Out of scope

The buildModel structured-diagnostics change (T-021). Any new field-def **validation
rules** beyond "a def must be an object" — `loadConfig.validate` already owns type/icon/
color checks.

## References

[`config.ts`](../packages/core/src/config.ts);
[`config.test.ts`](../packages/core/src/config.test.ts);
[`validate.ts`](../packages/core/src/validate.ts);
[ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database); T-017.
