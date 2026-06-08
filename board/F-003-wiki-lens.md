---
id: F-003
type: feature
title: Wiki lens
status: Draft
created: 2026-06-07T13:00:00Z
updated: 2026-06-07T13:00:00Z
phase: MVP
priority: P0
owner: mozart
sprint: S2
---

# F-003 — Wiki lens

A read-only file viewer with navigation: a file tree, a markdown reader (GFM), and
clickable internal links resolved by id. The reading surface behind every board card.

## Outcome

After this feature, `apps/web` has a working `WikiView`: a collapsible file tree on the
left, a rendered markdown reader on the right, and internal references (`see F-002`,
`[[F-002]]`, markdown links) that navigate within the app. It reads everything through the
`VaultSource` + core model — no direct disk access, no writes. This is the surface a board
card opens into (F-004-S-04).

## Context — read before starting

- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Inside an app — `WikiView` lives
  in `apps/web/src/views/wiki/` with an external template; shared pieces become
  `components/` only when a second user appears.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §1 (wiki ignores types/states; it
  renders any markdown) and §7 (reference forms).
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-004 (two independent lenses sharing
  one renderer) and ADR-002 (read-only).
- [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) — Angular 22 conventions (standalone
  components, signals, external templates).
- F-001 (the model: files + resolved references) and T-002 (the `HttpVaultSource` that feeds
  real files).

## Constraints (must honor)

- **Read-only**, **renders from the core model**, never writes. (ADR-002)
- **One renderer**: the markdown component built here (S-02) is the same one the board card
  reader reuses — don't fork it. (ADR-004)
- **Sanitize rendered HTML** before display; treat vault content as untrusted input.
- Standalone components + signals; external templates once non-trivial (per `apps/web`
  conventions and `docs/03-ARCHITECTURE.md`).

## Plan

Build the three stories: the file tree (S-01), the GFM renderer (S-02, the shared piece),
and clickable internal links over the rendered output (S-03). Wire them into `WikiView`,
fed by the `VaultSource` token already in `apps/web/src/sources`.

## Acceptance

- [ ] The tree lists the vault's markdown; selecting a file renders it.
- [ ] GFM (tables, fenced code, task lists) renders and is sanitized.
- [ ] A bare `F-001` mention in a doc is a working in-app link (MVP acceptance #3).

## Stories

F-003-S-01, F-003-S-02, F-003-S-03

## Dependencies

- **Depends on:** F-001 (model + references), T-002 (real files); icon/font polish from
  T-006 when present.
- **Blocks:** F-004-S-04 (board card opens in this reader).

## Out of scope

Editing, search beyond the tree, board logic (F-004), and live reload (F-005). Reading and
navigation only.

## References

ADR-002, ADR-004; `docs/03-ARCHITECTURE.md`, `docs/05-VAULT_SPEC.md`.
