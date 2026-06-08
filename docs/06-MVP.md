---
created: 2026-06-07T13:00:00Z
updated: 2026-06-07T13:00:00Z
---

# MVP scope

The first version is **one screen that matters: a read-only Kanban board over a markdown
vault**, plus a wiki viewer to read the files behind the cards. Nothing more. The
discipline of this project is keeping the MVP small.

## In scope

- Open a vault folder and read its `.mos/config.json`.
- Parse markdown + frontmatter into a model; resolve references by `id`.
- **Board lens:** columns from config, cards grouped by their type's state→column mapping,
  filter by sprint, cards showing the type's configured fields, a badge for `Blocked`,
  hidden states (`Deferred`/`Dropped`) kept off the board.
- **Wiki lens:** a file tree, a markdown reader (GFM: tables, code, task lists), and
  clickable internal links. Clicking a board card opens its file here.
- Live update when a file changes on disk (because the agent edited it).
- An `AGENTS.md` convention so an AI assistant can create and update cards correctly.

## Out of scope for the MVP

- Editing, creating, moving, or assigning cards inside the app (the agent does writes).
- Drag-and-drop and manual ordering (these are writes).
- Comments, a "needs attention" view, dependency graphs, search beyond simple text filter.
- Calendar / date scheduling.
- The MCP server and the VS Code extension.
- Desktop packaging — the MVP runs as a local web app; Tauri comes right after.

## Acceptance

The MVP is done when:

1. Opening this repository as a vault renders its `docs/` in the wiki and its `board/` as a
   board, matching the layout the reference validator prints.
2. Editing a card's `status` in a file (by hand or via an assistant) moves it on the board
   without a manual refresh.
3. A bare `F-001` mention in a doc is a working link.
4. Pointing mos at `examples/recipe-box` works with no code changes — proving the format is
   general, not hardcoded to this project.

## Build order

See the backlog in [`/board`](../board). In short: parser and config first (`F-001`,
`F-002`), then the two lenses (`F-003`, `F-004`), then live reload (`F-005`) and the
`AGENTS.md` convention (`F-006`). Everything else is [roadmap](07-ROADMAP.md).
