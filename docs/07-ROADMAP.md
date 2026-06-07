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

## Future — the ecosystem

- **`F-009` MCP write server.** A typed `createTask` / `setStatus` / `setSprint` / `assign`
  server so coding agents write through an API instead of prose conventions. Reuses the
  pure core.
- **`F-010` VS Code extension.** The board and wiki as a webview, for developers who won't
  leave the editor.
- **`F-011` In-app editing.** Optional write mode in the app itself, following the
  frontmatter-only discipline.

## Ideas, unscheduled

Date-based scheduling and a calendar view; sub-card nesting on the board; dependency-graph
visualization; manual drag ordering; multi-vault support; themes beyond light/dark. These
live as `Draft`/`Deferred` cards or notes and graduate only with a concrete need.
