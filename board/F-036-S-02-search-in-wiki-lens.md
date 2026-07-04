---
id: F-036-S-02
type: story
title: Search in the wiki lens — body-retaining load, scoped results, URL
status: Todo
priority: P2
owner: mozart
parent: F-036
estimate: L
touches: [web]
created: 2026-07-04T10:00:00Z
updated: 2026-07-04T12:00:00Z
---

# F-036-S-02 — Search in the wiki lens — body-retaining load, scoped results, URL

The smallest lovable version of search, completing the SLV with S-01: the wiki
lens gains a search box that indexes the whole vault (bodies included) and, while a
query is active, shows scoped, snippet-highlighted results in the sidebar; clicking
a result opens that file in the wiki content pane. No new route, no popup.

## Outcome

- **Body-retaining full-vault load (the prerequisite):** a `providedIn:'root'`
  `SearchIndexService` performs one unscoped `listFiles()` → `readFile` →
  `parseFile` pass that **keeps `parsed.body`** (the wiki already does this read but
  drops the body) and hands the `ParsedFile[]` to `buildSearchIndex`. Built lazily
  (only when the wiki/search is used), so board initial load is unaffected; the
  index rebuilds on entry for v1 (live update is S-04).
- **Search box + scope control in the wiki** ([`wiki-view`](../apps/web/src/views/wiki/wiki-view.html)):
  a query input above the sidebar and an All / Wiki / Board segmented control.
- **Results in the sidebar:** while `q` is non-empty, the sidebar shows a results
  **listbox** (each item = file name + a one-line snippet with matched terms in
  `<mark>`) in place of the file tree; clearing `q` restores the tree.
- **Scoping = folder filter** via the core `fileScopes`: Board = `board.include`,
  Wiki = the docs (wiki files outside the board folder), All = union.
- **Open in place:** selecting a result sets `/wiki?path=…&q=…&in=…` — the wiki's
  existing `?path=` selection shows the file in the content pane; `q` is carried so
  S-03 can highlight it. No `/card/:id`, no `/reader`, no side peek.
- **URL-driven (ADR-004):** `q` and `in=all|wiki|board` live in the URL and drive
  the view; bookmarkable. The board's reserved `?q=` is a different route and stays
  untouched.
- Honest empty / loading states; result count announced via `aria-live`.

## Context — read before starting

- [`apps/web/src/views/wiki/wiki-view.ts`](../apps/web/src/views/wiki/wiki-view.ts)
  and [`wiki-view.html`](../apps/web/src/views/wiki/wiki-view.html) — the lens to
  extend: it already reads the whole vault (hoist that into the body-retaining
  loader), renders the sidebar, and selects a file via `?path=`.
- [`apps/web/src/views/wiki/file-tree.ts`](../apps/web/src/views/wiki/file-tree.ts)
  — the roving-tabindex keyboard pattern to reuse for the results listbox.
- [`packages/core`](../packages/core) — `buildSearchIndex` / `querySearch` /
  `fileScopes` from S-01.
- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts)
  — `mergeParams`/URL idioms; the reserved `?q=` to avoid colliding with.

## Constraints (must honor)

- **Read-only (ADR-002); config-driven scoping (ADR-003); URL state (ADR-004).**
- All engine logic stays in core; this story is I/O + Angular only.
- **AXE/WCAG AA:** `role=search` on the box, combobox with
  `aria-expanded`/`aria-controls`/`aria-activedescendant`, listbox results, labeled
  scope control, `aria-live` count; keyboard-only usable (arrows to move, Enter to
  open, Esc to clear).
- Lazy-load the full-vault body index so board/other initial loads are unaffected.
- Do not regress the file-tree view when no query is active.

## Plan

1. `SearchIndexService`: one body-retaining full-vault read → `buildSearchIndex`.
2. Wiki: add the search box + scope control; bind `q`/`in` to the URL.
3. Sidebar: when `q` is set, render the results listbox (snippet `<mark>` from
   `querySearch` offsets) with keyboard nav; else the file tree.
4. Selecting a result → `/wiki?path=…&q=…&in=…` (reuse the wiki's `?path=` open).
5. Specs + AXE; verify board `?q=` unaffected and the tree returns on clear.

## Acceptance

- [ ] Typing in the wiki search box shows scoped, ranked body snippets with
      `<mark>` in the sidebar; clearing restores the file tree.
- [ ] All / Wiki / Board narrows results via config globs; `?q=&in=` is
      bookmarkable; board `?q=` untouched.
- [ ] Selecting a result opens the file in the content pane (`?path=…&q=…`).
- [ ] Keyboard-only usable; AXE green in both themes; honest empty/loading.
- [ ] Web tests green.

## Dependencies

- **Depends on:** F-036-S-01 (engine). **Blocks:** F-036-S-03 (highlight in the
  opened doc), F-036-S-04 (live re-index).

## Out of scope

In-document match highlighting + scroll (S-03, though this story carries `?q=`);
incremental watch re-index (S-04, index rebuilds on entry until then); any separate
search page or Cmd/Ctrl-K palette.

## References

F-036; [ADR-004](../docs/08-DECISIONS.md);
[`apps/web/AGENTS.md`](../apps/web/AGENTS.md).
