---
created: 2026-06-07T13:00:00Z
updated: 2026-06-11T23:00:00Z
---

# Roadmap

Phases are intentions, not promises. The MVP must prove itself before anything below it
earns real effort. Card IDs reference items in [`/board`](../board); the board is the
source of truth, this page is a readable snapshot.

## MVP — the board

Read-only Kanban + wiki over a markdown vault, run as a local web app.
Features `F-001`–`F-006`. See [`06-MVP.md`](06-MVP.md).

## Phase 2 — make it a real app, and richer

- **`F-007` Desktop app (Tauri).** Package the validated web app as a small native binary
  with native filesystem access and watching.
- **`F-008` Comments as files.** Comments live as their own markdown files linked to a card
  by id, with a "needs attention" view.
- **`F-012` Dependency graph lens.** A third read-only lens rendering cards as a dependency
  DAG, with critical-path and ready-set highlighting — the structural view that answers "what
  can I start in parallel right now." Makes `dependsOn` first-class frontmatter the future MCP
  (F-009) can read.
- **`F-014` Portable agent skills.** The mos skills (`ship-card`, `next-card`) authored in a
  root `skills/` folder in the standard installable layout — config-driven, vault-agnostic,
  usable in any project that has a `.mos/config.json`.
- **`F-015` Standalone CLI.** `npx mos serve` renders any vault's board and wiki without
  cloning this repo — the packaged, published form of the validated web app.
- **`F-016` Vault scaffolding.** `mos init` turns any folder into a valid vault (starter
  config, example card, agent-guide stub) — the first mile of adopting mos elsewhere.

## Phase 3 — the design refresh

The functional app, made desirable: a real design system and a Linear-grade board, ahead
of any write features. Direction and tokens: [`13-DESIGN_SYSTEM.md`](13-DESIGN_SYSTEM.md)
(ADR-016); board semantics: ADR-017/018/019.

- **`F-018` Design system — Ink & Highlight.** Custom `mos-paper`/`mos-carbon` themes,
  IBM Plex + Newsreader typography, semantic-token-only color, theme-keyed dark variant
  (fixes card colors following the OS instead of the toggle), vault name in the navbar.
- **`F-019` Sprint board & backlog.** The board shows one sprint at a time (dated sprints
  supported in config, spec 0.4 — ADR-017) with a config-driven filter bar; Backlog
  becomes its own ranked list of sprint-less cards (ADR-018).
- **`F-020` Cards lens.** A flat, filterable, sortable index of every card — the issues
  view — sharing the board's filter bar.
- **`F-021` Card page & peek.** A card opens two ways: a slide-over peek that keeps board
  context, and a full page with structured fields, relations, and children.
- **`F-022` Subcards on the board.** Containers leave the columns; leaf cards carry a
  parent breadcrumb chip; lists show container progress (ADR-019).

## Future — the ecosystem

- **`F-009` MCP write server.** A typed `createTask` / `setStatus` / `setSprint` / `assign`
  server so coding agents write through an API instead of prose conventions. Reuses the
  pure core.
- **`F-010` VS Code extension.** The board and wiki as a webview, for developers who won't
  leave the editor.
- **`F-011` In-app editing.** Optional write mode in the app itself, following the
  frontmatter-only discipline.

## Ideas, unscheduled

Date-based scheduling and a calendar view; manual drag ordering; multi-vault support;
themes beyond light/dark. These live as `Draft`/`Deferred` cards or notes and graduate
only with a concrete need.
