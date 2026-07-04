---
id: F-036
type: feature
title: Global vault search — scoped, highlighted, in the wiki lens
status: In Progress
priority: P2
phase: Phase 4
owner: mozart
touches: [core, web, docs]
created: 2026-07-04T10:00:00Z
updated: 2026-07-04T22:28:35Z
---

# F-036 — Global vault search — scoped, highlighted, in the wiki lens

mos can filter the board by frontmatter facets (F-023) and open any file in the
reader, but there is no way to **search the whole vault by content**. The current
`cardSearchText` (filters.ts) matches only a card's id, title, and string fields
— never the document body — and only over already-loaded board cards.

This feature adds search **inside the existing wiki lens** — the wiki is already
the universal reader (a sidebar file tree + a content pane) that shows *every*
markdown file, board cards included (`/wiki?path=board/E-0001-…md`). So search is
not a new page or a popup: you type a query in the wiki, matching files appear in
the sidebar with highlighted snippets, and clicking one opens it **right there**
in the content pane with the match highlighted and scrolled to. This is the
Obsidian model, and it fits a markdown vault.

**How hard / what's the prerequisite** (the two scoping questions): overall a
**Large** feature, but the *smallest lovable version* (S-01 + S-02) is a
self-contained, in-wiki search. The one hard **prerequisite** is that **no surface
retains file bodies today**: the wiki reads every file (`listFiles()` → `readFile`
→ `parseFile`) but drops `parsed.body`, and `buildModel` keeps only frontmatter
(`Card` has no `body` field, models.ts). So a **body-retaining full-vault load**
must exist to feed the index — that is the load-bearing new work; everything else
reuses patterns already in the repo (config globs for scoping, the wiki's
whole-vault read, its `?path=` selection, the markdown-reader's DOM walk for
highlighting).

## Outcome

- **Full-text over bodies, inside the wiki:** a search box in the wiki lens
  searches every file's body (plus title) — the exact gap today. While a query is
  active, the sidebar shows results (file + a snippet with matched terms in
  semantic `<mark>`) instead of the file tree; clearing the query restores the
  tree.
- **Open in place:** clicking a result selects that file in the wiki
  (`/wiki?path=…&q=…`), shows it in the content pane, and highlights + scrolls to
  the match — never a new page, never a side peek.
- **Scoped (All / Wiki / Board) = a folder filter:** Board = the board cards,
  Wiki = the prose docs, All = both — derived from the vault's own
  `board.include` and `wiki.include`/`wiki.exclude` globs, nothing new. URL:
  `/wiki?q=…&in=all|wiki|board` (bookmarkable, ADR-004).
- **Pure-core engine, zero new core dependency:** the index build + query live in
  `packages/core` (ADR-001-pure, unit-testable over string fixtures) as a
  hand-rolled folded (lowercased, diacritic-stripped) **substring** index reusing
  the `cardSearchText` rule and the `references.ts` offset-scan idiom — behind a
  clean `SearchIndex`/`querySearch` boundary so **MiniSearch** (MIT, ~7 KB, TS)
  can be dropped in *in `apps/web`* later if a vault ever outgrows linear scan or
  needs fuzzy/stemming/relevance ranking. No dependency is added for v1.
- **Build once, every surface inherits it:** because the engine is in `core`, the
  search is reused by the CLI's served web, the future Tauri desktop app, a
  potential MCP search *tool*, and a VS Code extension — with no reimplementation.
  Only the `VaultSource` differs per platform, and that seam already exists
  (T-005: "swaps the I/O adapter only; UI and core unchanged").
- **Read-only (ADR-002), config-free to use, AXE/WCAG AA.**

## Design decisions (settled)

- **Match rule:** folded substring — `cat` matches `category`; case- and
  accent-insensitive. One rule (in core) backs the index, the snippet, and the
  in-document highlight so they never disagree on what's a hit.
- **No smart-search in v1:** fuzzy/typo tolerance, stemming, and BM25 relevance
  ranking are deferred; ranking is title-weighted match count. Adopting MiniSearch
  is the planned path if these become needed — the engine boundary makes it a
  drop-in.
- **Search lives in the wiki lens** — not a new `/search` route and not a
  Cmd/Ctrl-K palette. Results open in place via the wiki's existing `?path=`
  selection; the side peek is not used.
- **Scope is a folder filter** driven by config globs (All / Wiki / Board).

## Context — read before starting

- [`apps/web/src/views/wiki/wiki-view.ts`](../apps/web/src/views/wiki/wiki-view.ts)
  and [`wiki-view.html`](../apps/web/src/views/wiki/wiki-view.html) — the lens that
  gains the search box + results-in-sidebar; it already reads the whole vault (then
  drops bodies) and selects a file via `?path=`.
- [`apps/web/src/views/wiki/file-tree.ts`](../apps/web/src/views/wiki/file-tree.ts)
  — the sidebar list + roving-tabindex keyboard pattern the results list reuses.
- [`packages/core/src/filters.ts`](../packages/core/src/filters.ts) —
  `cardSearchText`: the frontmatter match rule the core index folds and extends to
  bodies.
- [`packages/core/src/models.ts`](../packages/core/src/models.ts) — `buildModel`
  drops `ParsedFile.body`; `Card` has no `body`. The prerequisite lives here and in
  the wiki loader.
- [`packages/core/src/config.ts`](../packages/core/src/config.ts) /
  [`references.ts`](../packages/core/src/references.ts) — `globToRegExp` /
  `toPosixPath` (scope membership) and the offset-yielding scan idiom (`findIds`).
- [`apps/web/src/components/markdown-reader/markdown-reader.ts`](../apps/web/src/components/markdown-reader/markdown-reader.ts)
  — the wiki content pane; its `TreeWalker` + `SKIP_TAGS` DOM pass the in-document
  highlighter reuses (F-003-S-03: never index offsets into rendered HTML).

## Constraints (must honor)

- **Pure core (ADR-001).** Index build, query, ranking, snippet offsets, and the
  scope helper are pure TS over `ParsedFile[]` + config — no fs/network/framework,
  no new core dependency for v1.
- **One shared match rule** (folded substring), living once in core.
- **Read-only (ADR-002); config-driven scoping (ADR-003); URL state (ADR-004).**
- **Snippet offsets index SOURCE text only;** in-document highlighting is a
  term/DOM pass, never an offset into rendered HTML.
- **AXE / WCAG AA:** the search box + results list get combobox/listbox semantics,
  roving keyboard, `aria-live` count; `<mark>` contrast verified in both themes.

## Plan

Smallest lovable version = **S-01 + S-02** (type in the wiki, get scoped
highlighted snippets, click to open in place). Then in-doc highlight (S-03) and
live re-index (S-04).

1. **S-01 — Pure-core search index, query, snippet offsets, scope helper** (core).
2. **S-02 — Search in the wiki lens: body-retaining load, scoped results, URL** (web).
3. **S-03 — In-document highlight + scroll in the content pane** (web).
4. **S-04 — Incremental watch re-index** (web, core).

## Acceptance

- [ ] A search box in the wiki searches file **bodies** across the vault; while a
      query is active the sidebar shows results with `<mark>`-highlighted snippets;
      clearing restores the tree.
- [ ] All / Wiki / Board scopes results via the config globs; state is in
      `?q=&in=` and bookmarkable.
- [ ] Clicking a result opens the file in the wiki content pane (`?path=…&q=…`)
      with the match highlighted and scrolled to — no new page, no side peek.
- [ ] The engine is pure `packages/core`, dependency-free, unit-tested; the
      `SearchIndex`/`querySearch` boundary is clean enough to swap in MiniSearch
      with no caller changes.
- [ ] The board's own `?q=` filter is untouched; AXE passes in both themes.
- [ ] `bun run lint && bun run test && bun run build && bun run validate` green.

## Out of scope

- Fuzzy/typo tolerance, stemming, BM25 relevance, cross-field boosting beyond a
  title-over-body weight, and the MiniSearch swap itself — deferred behind the
  clean engine boundary until the substring rule proves too blunt.
- A separate `/search` lens and a global Cmd/Ctrl-K palette (search from other
  lenses) — a possible future convenience; v1 lives in the wiki.
- Any vault writes; any server/CLI change beyond serving the same web build.

## Dependencies

- **Depends on:** — (wiki, board, filters, references already exist). **Blocks:** —

## References

ADR-001, ADR-002, ADR-003, ADR-004; F-023 (facet filters), F-021 (reader),
F-003-S-03 (no offset-into-HTML); MiniSearch (MIT, future fallback);
[`apps/web/AGENTS.md`](../apps/web/AGENTS.md).
