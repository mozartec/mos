---
id: F-017
type: feature
title: Relative markdown links navigate in-app
status: Done
priority: P1
phase: Phase 2
owner: mozart
created: 2026-06-10T20:40:00Z
updated: 2026-06-10T20:41:35Z
---

# F-017 — Relative markdown links navigate in-app

Clicking an ordinary markdown link like `[spec](05-VAULT_SPEC.md)` in a rendered page
currently triggers a real browser navigation to a route that doesn't exist — a 404. Only
id-shaped references (`F-014`, `RB-002`, …) are interactive today (F-003-S-03 scoped them
only). After this feature, every internal link a vault author writes the normal way works
in both worlds: rendered on GitHub *and* inside mos — with no mos-specific syntax.

## Outcome

In every rendered markdown surface (wiki, reader — board cards open through the same
reader):

- A **relative link to a vault file** (`05-VAULT_SPEC.md`, `../docs/03-ARCHITECTURE.md`,
  `board/T-008-publish-cli.md`) resolves against the current file's folder and opens the
  target **in-app** via the existing routes, history intact (back returns to the source
  page). No full-page navigation, no 404.
- A **link to a file that doesn't exist** renders visibly inert (same treatment as
  unresolved id references), so a broken link is diagnosable at a glance instead of
  404-ing.
- An **external link** (`http://`/`https://`/`mailto:`) opens normally in a new tab with
  `rel="noopener noreferrer"`.
- **Id references keep working** exactly as they do now.

The authoring convention stays plain relative paths — exactly what GitHub renders
correctly — so the same file navigates on GitHub and in mos with zero special syntax.

## Context — read before starting

- [`apps/web/src/components/markdown-reader/markdown-reader.ts`](../apps/web/src/components/markdown-reader/markdown-reader.ts)
  — the id-reference linkifier and the `a[data-path]` click interception this feature
  generalizes; the `navigate` output the views already wire up.
- [`board/F-003-S-03-clickable-links.md`](F-003-S-03-clickable-links.md) — how id links
  were scoped and why unresolved ones render dimmed; this feature extends that contract
  to path links.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §7 Link resolution — currently
  documents id resolution; gains the relative-path rules.
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) — gains the link-authoring
  guidance (relative paths, GitHub-compatible).

## Constraints (must honor)

- **Pure core** (ADR-001): the path resolver (`./`/`../` normalization, percent-decoding,
  fragment/query stripping) is a pure function in `packages/core` with unit tests; the
  component only consumes it.
- **Read-only** (ADR-002) and **config-driven** (ADR-003): resolution checks targets
  against the vault's *file listing* — never against hardcoded folder names, so it works
  with any `wiki`/`board` path configuration.
- **GitHub compatibility is the contract**: nothing may require authors to write links
  differently for mos than for GitHub. If a link form renders on GitHub but can't work in
  mos, it degrades to the inert treatment — never a 404.
- **Routing stays as-is**: the existing reader/wiki routes (query-param deep links) are
  the navigation target; URL-scheme changes are out of scope.

## Plan

1. Core: `resolveRelativeLink(currentPath, href)` → normalized vault path or null
   (rejects escapes above the vault root, strips `#fragment`/`?query`, decodes `%20`),
   plus tests.
2. Markdown reader: post-render, classify every `<a href>` — external scheme → new tab +
   `rel`; resolvable vault path (present in the listing, case-exact) → `data-path` +
   in-app navigation through the existing `navigate` output; otherwise inert (dimmed,
   like unresolved ids).
3. Views: confirm wiki/reader `navigate` wiring covers the new path links (board cards
   already open via the reader); add specs for click-through and back-navigation.
4. Docs: extend `05-VAULT_SPEC.md` §7 with relative-path resolution rules; add the
   authoring convention to `09-CONVENTIONS.md`; reflect in `12-ADOPTING.md` if it speaks
   about linking.

## Acceptance

- [x] Clicking a same-folder link (`05-VAULT_SPEC.md` from a docs page) and a
      cross-folder link (`../docs/03-ARCHITECTURE.md` from a board card) opens the
      target in-app; browser back returns to the source page.
- [x] The same files render with working links on GitHub — no mos-specific link syntax
      anywhere in the repo's markdown.
- [x] A link to a missing file renders inert and visibly dimmed — never a 404.
- [x] External links open in a new tab with `rel="noopener noreferrer"`.
- [x] Id references behave exactly as before (existing specs stay green).
- [x] The core resolver is pure, unit-tested (traversal, `./`, fragments, encoded
      spaces), and `05-VAULT_SPEC.md` §7 + `09-CONVENTIONS.md` document the rules.

## Dependencies

- **Depends on:** — **Blocks:** —

## Out of scope

URL-scheme changes (path-mirroring routes), in-page `#heading` anchor scrolling,
non-markdown link targets (images/assets — the server doesn't serve them), and link
rewriting at write time (authoring stays plain markdown).

## References

ADR-001, ADR-002, ADR-003; `docs/05-VAULT_SPEC.md` §7, `docs/09-CONVENTIONS.md`;
F-003-S-03.
