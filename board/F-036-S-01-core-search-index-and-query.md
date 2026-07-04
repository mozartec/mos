---
id: F-036-S-01
type: story
title: Pure-core search index, query, snippet offsets, and scope helper
status: Todo
priority: P2
owner: mozart
parent: F-036
estimate: M
touches: [core]
created: 2026-07-04T10:00:00Z
updated: 2026-07-04T10:00:00Z
---

# F-036-S-01 — Pure-core search index, query, snippet offsets, and scope helper

The engine that all search surfaces build on: a pure `packages/core` capability
that indexes file bodies + titles, answers scoped queries with ranked hits, and
returns snippet offsets for highlighting — dependency-free and unit-testable over
string fixtures. No I/O, no framework; the app feeds it `ParsedFile[]`.

## Outcome

- New pure exports from [`packages/core/src/index.ts`](../packages/core/src/index.ts):
  - `buildSearchIndex(files: ParsedFile[], config): SearchIndex` — indexes each
    file's `title` (weighted over body) and full `body`, tagging each doc with its
    scope set.
  - `querySearch(index, { q, scope }): SearchHit[]` — ranked hits with `path`,
    scope(s), title, and a snippet as **source-text offsets** `{ start, end }` (or
    `{ before, match, after }` segments) around the first match.
  - `applySearchChange(index, config, path, file | null): SearchIndex` —
    add/replace/remove one path, mirroring `applyFileChange` (for S-05).
  - `fileScopes(path, config): ('wiki'|'board')[]` — the scope **set** via the
    exact `globToRegExp`/`toPosixPath` membership `buildModel` uses; `'wiki'` when
    the path matches `wiki.include` (defaulting to `['**/*.md']` when empty) minus
    `wiki.exclude`, `'board'` when it matches `board.include`.
- **One shared match rule** — a folded (lowercased, diacritic-stripped) match,
  extending the `cardSearchText` rule (filters.ts) — lives here and is the single
  source the snippet extractor and (later) the DOM highlighter reuse.
- Ranking for v1: title-weighted match count (no BM25); deterministic tie-break by
  path so results are stable.
- Fully unit-tested: body match, title boost, scope-set membership (overlap and
  gap cases), empty-`wiki.include` fallback, snippet offsets landing on the source
  string, and `applySearchChange` add/replace/remove.

## Context — read before starting

- [`packages/core/src/filters.ts`](../packages/core/src/filters.ts) —
  `cardSearchText` / `matchesFilters`: the match rule to fold and extend to bodies.
- [`packages/core/src/models.ts`](../packages/core/src/models.ts) — `ParsedFile`
  (has `body`), `buildModel` (the membership test to mirror), `applyFileChange`
  (the shape `applySearchChange` follows).
- [`packages/core/src/config.ts`](../packages/core/src/config.ts) /
  [`references.ts`](../packages/core/src/references.ts) — `globToRegExp` /
  `toPosixPath`; the offset-yielding scan idiom (`findIds`) for `extractSnippet`.
- [ADR-001](../docs/08-DECISIONS.md) — core is pure.

## Constraints (must honor)

- **Pure (ADR-001):** no fs/network/framework, no new dependency, no throw on bad
  input; unresolved/odd paths handled, not crashed on.
- **Scope is a set, `All` is a union** — never assume board ⊎ wiki partitions the
  vault.
- Snippet offsets index **source** body text only.
- Keep the `SearchIndex` / `querySearch` boundary clean and engine-agnostic so a
  MiniSearch implementation could satisfy it later without caller changes.

## Plan

1. Types: `SearchDoc`, `SearchIndex`, `SearchHit`.
2. `fileScopes` + `buildSearchIndex` (fold titles+bodies into the index).
3. `querySearch` (filter by scope, rank, extract snippet offsets).
4. `applySearchChange`; export all from the barrel.
5. Vitest over string fixtures (`bunx vitest run` in `packages/core`).

## Acceptance

- [ ] `buildSearchIndex` / `querySearch` / `applySearchChange` / `fileScopes` are
      exported, pure (no I/O, no throw), and body text is searchable with a title
      boost.
- [ ] Scope is a union set; empty `wiki.include` falls back to `**/*.md`;
      overlap/gap cases are correct.
- [ ] Snippet offsets index the source body string; one shared folded match rule
      backs index + snippet.
- [ ] `packages/core` tests green.

## Dependencies

- **Depends on:** —. **Blocks:** F-036-S-02 (the wiki search consumes this), S-04.

## Out of scope

Any UI, I/O, or file loading (S-02); in-document highlighting (S-03); MiniSearch;
fuzzy/stemming/BM25.

## References

F-036; [`packages/core/src/filters.ts`](../packages/core/src/filters.ts);
[ADR-001](../docs/08-DECISIONS.md).
