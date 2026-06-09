---
id: T-007
type: task
title: Consistent error handling across core
status: Todo
dependsOn: [T-001]
created: 2026-06-09T20:18:00Z
updated: 2026-06-09T20:18:00Z
phase: MVP
priority: P1
owner: mozart
sprint: S2
---

# T-007 — Consistent error handling across core

Audit and fix error handling so core functions return diagnostics consistently and the UI
surfaces them visibly — no swallowing, no inconsistent throw-vs-return.

## Outcome

After this task, every public `packages/core` function follows a single error contract:
errors are returned as diagnostics in the result, never thrown past the public surface, and
never silently swallowed. The UI displays errors to the user (e.g. "N cards couldn't be
placed") instead of hiding them in `console.error`.

## Context — read before starting

- [`packages/core/src/place-card.ts`](../packages/core/src/place-card.ts) — `placeCard`
  **throws** on unknown type/status. The board-view wraps it in try/catch and logs to
  console. This is the opposite of what `loadConfig`, `buildModel`, and `parseFrontmatter`
  do (they return errors in the result).
- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts)
  L85–88 — swallows `placeCard` errors with `console.error`. The user never sees them.
- [`packages/core/src/config.ts`](../packages/core/src/config.ts) — `loadConfig` returns
  `{ config, errors }`: the pattern to follow.
- [`packages/core/src/models.ts`](../packages/core/src/models.ts) — `buildModel` returns
  `{ model, diagnostics }`: same pattern.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-001 (pure core; no-throw is the
  implicit contract for functions consumed by the UI).

## Constraints (must honor)

- **Pure core.** Error handling stays in `packages/core`; no framework deps. (ADR-001)
- **No-throw past the public surface.** All public functions return result types. Internal
  helpers may throw if the caller catches. (Established by `loadConfig`/`buildModel`.)
- **Visible errors.** The UI must show placement/config errors to the user — not
  `console.error` only. A diagnostics panel, a toast, or a "N cards skipped" badge.
- **Non-destructive.** A bad card should not crash the board; show what can be shown, flag
  what can't.

## Plan

1. Change `placeCard` to return `CardPlacement | { error: string }` (or add an `error`
   field to `CardPlacement`). Remove the throws.
2. Update `board-view.ts`: remove the try/catch; use the returned error. Collect placement
   errors into a signal and display a summary in the template.
3. Audit `resolveReferences`, `parseFile`, and any other public core function for consistency.
4. Add/update tests for the error-path behavior.

## Acceptance

- [ ] `placeCard` returns errors in the result, not thrown.
- [ ] The board UI shows a visible message when cards can't be placed (not just console).
- [ ] All public core functions follow the same error-return pattern.
- [ ] Existing tests pass; new tests cover the error paths.

## Dependencies

- **Depends on:** T-001. **Blocks:** —

## Out of scope

A full diagnostics panel with per-file error detail (that's a later UX feature). Enough to
surface "N cards couldn't be placed" visibly and consistently.

## References

ADR-001; `docs/03-ARCHITECTURE.md`.
