---
id: F-021-S-02
type: story
title: Card page — detail component, /card route, reader redirect
status: Todo
priority: P1
owner: mozart
parent: F-021
estimate: M
dependsOn: [F-021-S-01, F-023]
touches: [web]
created: 2026-06-21T09:31:58Z
updated: 2026-06-21T09:31:58Z
---

# F-021-S-02 — Card page: detail component, /card route, reader redirect

A card today opens in the generic file reader. This story adds the **dedicated card page**:
a reusable card-detail component (structured header, relations, rendered body), an
id-addressed route, and a redirect so old reader-with-card links land on it. The same
detail component is reused by the side peek (F-021-S-03), so it is built standalone here.

## Outcome

- A **card-detail component** rendering: a structured header (mono id, type badge, title,
  the type's configured field chips — status/priority/owner/scope, config-driven as on
  board cards), then **relations** (parent breadcrumb, `dependsOn` with each dependency's
  status, *dependents*, children with a progress summary — all from F-021-S-01's core
  lookups), then the markdown body via the shared reader (F-017 link behavior).
- A **card page** at an id-addressed route (e.g. `/card/F-004`), lazy-loaded like the other
  lenses (ADR-004), bookmarkable and rendering on load.
- Relations are clickable: ids navigate within the page with a sensible back-trail.
- **Old reader deep links to board cards redirect** to the card page; wiki/doc reading is
  untouched (plain docs still open in the reader).
- Back-navigation honors the originating board's scope + filter params (F-023), exactly as
  the reader does today.

## Context — read before starting

- Parent feature F-021 — Outcome/Constraints/Acceptance for the whole detail surface.
- F-021-S-01 — `childrenOf` / `dependentsOf` / progress rollup; the relations data source
  (do not re-derive view-side).
- [`apps/web/src/views/reader/reader-view.ts`](../apps/web/src/views/reader/reader-view.ts)
  — current card-opening flow; the `path`/`from` params plus the originating board's scope
  + filter state to honor on back-navigation (F-023 made scope config-named — no `sprint`
  param).
- [`apps/web/src/components/markdown-reader`](../apps/web/src/components/markdown-reader) —
  the renderer to reuse for the body (id links, relative links — F-017).
- [`apps/web/src/app/app.routes.ts`](../apps/web/src/app/app.routes.ts) — the route manifest
  to extend with the card route + the reader redirect.
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — chip idioms, elevation, mono
  ids.
- [ADR-019](../docs/08-DECISIONS.md#adr-019) — children/progress presentation on detail
  surfaces. [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) — a11y bar.

## Constraints (must honor)

- **Read-only (ADR-002):** the page renders state; no write affordances.
- **Config-driven (ADR-003):** header fields come from the card's type definition; works
  for recipe-box types unchanged.
- **URLs are contracts:** the page is bookmarkable; existing reader deep links to cards keep
  working via redirect.
- **One renderer:** reuse the shared markdown reader for the body — no board-specific fork.

## Plan

1. Build the card-detail component (header, relations, body) consuming F-021-S-01's
   lookups; standalone so the peek (S-03) can host it.
2. Add the `/card/:id` route (lazy) and a redirect from the old reader-with-card-path; honor
   F-023 back-navigation params.
3. Specs: page deep-link renders on load, header shows configured fields, relations list
   parent/dependencies(+status)/dependents/children(+progress) and are clickable, redirect
   works, wiki docs still open in the reader, recipe-box fixture renders.

## Acceptance

- [ ] Direct navigation to a card route lands on the card page; the URL is shareable and
      renders on load.
- [ ] The header shows the type's configured fields; relations list parent, dependencies
      (with status), dependents, and children with a progress summary — all clickable.
- [ ] Old reader links to board cards redirect to the card page; wiki docs still open in the
      reader exactly as before.
- [ ] recipe-box renders with no code changes; AXE passes on the page.

## Dependencies

- **Depends on:** F-021-S-01 (relation data), F-023 (reader params / shared open behavior).
  **Blocks:** F-021-S-03 (reuses this detail component).

## Out of scope

The side-peek overlay, scrim, and focus trap/restore (F-021-S-03); container board
placement (F-022); any editing (ADR-002).

## References

F-021; F-021-S-01; F-023; [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md);
[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer),
[ADR-019](../docs/08-DECISIONS.md#adr-019); F-017.
</content>
