---
id: F-018
type: feature
title: Design system — Ink & Highlight visual refresh
status: Draft
priority: P1
phase: Phase 3
owner: mozart
created: 2026-06-11T23:00:00Z
updated: 2026-06-11T23:00:00Z
---

# F-018 — Design system — Ink & Highlight visual refresh

The app works but looks like a wireframe — literally: it ships daisyUI's stock
`wireframe`/`black` themes, which define `primary`, `secondary`, and `accent` as gray, set
in Inter. After this feature the app wears its own skin: warm paper-and-carbon themes with
a highlighter-amber accent, IBM Plex typography with serif prose, and every color routed
through theme tokens — including the card colors that today follow the OS scheme instead
of the in-app theme toggle.

## Outcome

- Two custom daisyUI themes — **`mos-paper`** (light, default) and **`mos-carbon`**
  (dark, `prefersdark`) — replace `wireframe`/`black`, with the exact token values from
  [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md).
- Typography per the design system: IBM Plex Sans (UI), IBM Plex Mono (ids/code),
  Newsreader (rendered markdown prose only) — self-hosted via Fontsource like the current
  fonts.
- The Tailwind `dark:` variant is re-keyed to `data-theme='mos-carbon'` via
  `@custom-variant`, so the curated card-color ramp follows the theme toggle, not the OS
  (the bug ADR-016 records).
- The navbar brand is the vault's `vault.name` from config; the "mos" mark moves to a
  small fixed element. Lens navigation becomes tabs.
- All four views (wiki, board, graph, reader) restyled against semantic tokens only;
  shape/depth/density and motion rules from the design system applied (column wells,
  hairline borders, no pulsing badges).

## Context — read before starting

- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — the spec this implements:
  theme blocks to copy verbatim, typography table, component idioms, motion, a11y bar.
- ADR-016 in [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — the decision and the
  dark-variant bug context.
- [`apps/web/src/styles.css`](../apps/web/src/styles.css) — current fonts and the two
  stock theme blocks this replaces.
- [`apps/web/src/services/theme-service.ts`](../apps/web/src/services/theme-service.ts) —
  theme names and the persisted `mos-theme` localStorage value (needs migration of the
  old `wireframe`/`black` values).
- [`apps/web/src/components/card/card-style.ts`](../apps/web/src/components/card/card-style.ts)
  — the curated color ramp; keeps raw Tailwind classes but must rely on the re-keyed
  `dark:` variant.
- [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) — Angular conventions and the AXE/WCAG AA
  requirement.

## Constraints (must honor)

- **Semantic tokens only** (ADR-016): after this lands, raw Tailwind palette classes
  exist solely in `card-style.ts`. Verify with a grep over templates/styles.
- **Config-driven** (ADR-003): the navbar name comes from `vault.name`; no hardcoded
  vault branding.
- **Read-only app** (ADR-002); **pure core untouched** (ADR-001) — this is a rendering
  change.
- **WCAG AA / AXE-clean** on all four views; visible focus rings; reduced-motion honored.
- **No layout/UX restructuring** — the sprint board, filters, peek, etc. are F-019…F-022;
  this card restyles what exists.

## Plan

1. Swap Fontsource imports (`ibm-plex-sans` 400/500/600, `ibm-plex-mono` 400/500,
   `newsreader` 400/500 + italic); set `--font-sans`/`--font-mono` and scope Newsreader to
   the prose container.
2. Replace the two theme blocks in `styles.css` with `mos-paper`/`mos-carbon` from the
   design doc; add the `@custom-variant dark` line.
3. Update `ThemeService` (`Theme` union, defaults, migrate stored `wireframe`→`mos-paper`,
   `black`→`mos-carbon`).
4. App shell: vault name from config in the navbar (loading state included), tabs for
   lenses, "mos" mark + theme toggle grouped.
5. Sweep views/components for stock-theme assumptions (gray-on-gray board wells, badge
   styles, pulse animation, focus styles) and align to the design doc's idioms.
6. Verify: grep for raw palette classes outside `card-style.ts`; AXE + contrast pass on
   all views in both themes; toggle-vs-OS matrix renders card colors correctly.

## Acceptance

- [ ] `mos-paper`/`mos-carbon` are the only registered themes, token-identical to
      `docs/13-DESIGN_SYSTEM.md`; OS preference picks the default, the toggle overrides,
      and a previously stored `wireframe`/`black` value migrates cleanly.
- [ ] With OS light + app dark (and the reverse), card type/priority colors render for
      the **app** theme — a spec covers the re-keyed `dark:` variant.
- [ ] Plex Sans/Mono and Newsreader load self-hosted; rendered markdown prose is
      Newsreader, UI chrome is Plex Sans, ids are Plex Mono.
- [ ] The navbar shows the vault's configured name (this repo: "Markdown on Steroids";
      recipe-box shows its own) — nothing hardcoded.
- [ ] No raw Tailwind palette class outside `card-style.ts` (checked by grep/lint), and
      AXE passes on wiki, board, graph, and reader in both themes.

## Dependencies

- **Depends on:** — **Blocks:** F-019 (the new board should be built on the new tokens,
  not restyled twice).

## Out of scope

Board structure changes (sprint scope, filters — F-019), new views (F-020/F-021), any
config/spec change, and any additional theme beyond the two.

## References

ADR-016; `docs/13-DESIGN_SYSTEM.md`; `docs/05-VAULT_SPEC.md` §5b (curated colors).
