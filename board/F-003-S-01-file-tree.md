---
id: F-003-S-01
type: story
title: File tree browser
status: Done
priority: P0
owner: mozart
sprint: S2
parent: F-003
estimate: S
dependsOn: [F-001-S-02, T-002]
created: 2026-06-07T13:00:00Z
updated: 2026-06-10T00:18:00Z
---

# F-003-S-01 — File tree browser

A collapsible tree of the vault's folders and markdown files for browsing without the board.

## Outcome

`WikiView` shows a collapsible tree of the vault's wiki-scope markdown files, grouped by
folder. Selecting a file emits its path so the reader (F-003-S-02) renders it. The tree is
built from `model.files` — no disk access in the component.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §1 — the wiki renders any markdown in
  scope; types/states don't matter here.
- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Inside an app — component lives
  under `views/wiki/`; extract a `components/` tree only if reused.
- [`.mos/config.json`](../.mos/config.json) `wiki.include`/`exclude` — already excludes
  `apps/**`, `packages/**`, etc., so the tree shows `docs/`, `board/`, root docs.
- F-001-S-02 — `model.files` is the input.

## Constraints (must honor)

- Read-only; build the tree from the model, not the filesystem. (ADR-001, ADR-002)
- Standalone component + signals; keyboard-focusable rows for accessibility.

## Plan

1. Group `model.files` into a nested folder structure (pure helper, unit-testable).
2. Render expandable folders + selectable file rows; track expanded state and selection in
   signals.
3. Emit `select(path)` upward to `WikiView`.

## Acceptance

- [x] The tree lists the vault's wiki-scope markdown, nested by folder, collapsible.
- [x] Selecting a file notifies the view of the chosen path.
- [x] Excluded paths (`apps/**`, `node_modules/**`, …) don't appear.

## Dependencies

- **Depends on:** F-001-S-02 (model files), T-002 (real files to list).
- **Blocks:** —

## Out of scope

Rendering the file (F-003-S-02), links (F-003-S-03), search/filter. Navigation tree only.

## References

ADR-001, ADR-002; `docs/05-VAULT_SPEC.md` §1; `docs/03-ARCHITECTURE.md`.
