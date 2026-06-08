---
id: T-006
type: task
title: Icon set (Tabler) + self-hosted fonts (Fontsource)
status: Done
created: 2026-06-07T13:00:00Z
updated: 2026-06-08T16:45:00Z
phase: MVP
priority: P1
owner: mozart
sprint: S2
---

# T-006 — Icon set (Tabler) + self-hosted fonts (Fontsource)

Establish the project's visual primitives — a single icon set and the UI/mono typefaces —
so the wiki and board (F-003, F-004) are built on a consistent, self-hosted foundation
instead of ad-hoc glyphs and the system font stack.

## Outcome

After this task, `apps/web` has Tabler icons available as a tidy, tree-shakeable mechanism
and the project's two typefaces self-hosted via Fontsource and wired into the Tailwind v4 +
daisyUI theme: **Inter** for UI text and **JetBrains Mono** for code blocks, card ids, and
other monospace contexts. No runtime CDN dependency, no FOUT from a third-party font host.
A developer building a card face (F-004-S-02) or the markdown reader (F-003-S-02) reaches for
`<font-mono>`/an icon component instead of inventing one. (Decision recorded in ADR-009.)

## Context — read before starting

- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — **ADR-009** (this task's decision:
  Tabler icons + Fontsource Inter/JetBrains Mono, self-hosted, per-user font switching is a
  later option).
- [`apps/web/src/styles.css`](../apps/web/src/styles.css) — Tailwind v4 CSS-first setup with
  `@import 'tailwindcss'` and daisyUI themes; fonts wire in here via `@font-face` (Fontsource)
  and a `--font-sans`/`--font-mono` theme token, not in `index.html`.
- [`docs/04-TECH_STACK.md`](../docs/04-TECH_STACK.md) — Tailwind + daisyUI, Angular 22; keep
  the dependency list lean.
- [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) — Angular conventions for any icon component.
- [`.agents/skills/turborepo/`](../.agents/skills/turborepo) — before adding deps to the
  `apps/web` package.

## Constraints (must honor)

- **Self-hosted only** — fonts and icons ship from npm (Fontsource, `@tabler/icons`), no
  Google Fonts / CDN at runtime. (ADR-009)
- **One icon set** — Tabler only; don't mix icon libraries. (ADR-009)
- **Tailwind v4 CSS-first** — register fonts in `styles.css` and expose them as theme tokens
  (`--font-sans`, `--font-mono`) so utilities like `font-mono` resolve to the project fonts;
  don't hardcode font-family strings in components.
- Read-only app rule is unaffected; this is presentation only. (ADR-002)
- Load only the weights actually used (e.g. Inter 400/500/600, JetBrains Mono 400/500) to
  keep the bundle small.

## Plan

1. Add Fontsource deps for Inter and JetBrains Mono to `apps/web`; import the needed weights
   in `styles.css`; set `--font-sans: Inter, …` and `--font-mono: 'JetBrains Mono', …` and a
   base `font-family` on the body.
2. Apply `font-mono` to code blocks (F-003-S-02) and card ids (F-004-S-02) once those exist;
   for now prove it on the existing shell.
3. Add Tabler icons (`@tabler/icons` SVGs, or `@tabler/icons-webfont`) with a small
   standalone `IconComponent` wrapper (name in, sized SVG out) under `apps/web/src/components`.
4. Verify no CDN/network font requests at runtime; confirm `bun run dev` renders with the new
   fonts and a sample icon.

## Acceptance

- [ ] UI text renders in Inter and monospace contexts in JetBrains Mono, both self-hosted
      (no network font requests).
- [ ] Fonts are exposed as Tailwind/daisyUI theme tokens so `font-mono`/`font-sans` resolve
      to them; no hardcoded font-family in components.
- [ ] A Tabler icon renders via a single reusable mechanism; only Tabler is used.
- [ ] `bun run lint` and `bun run build` pass with the new deps; bundle only includes the
      weights used.

## Dependencies

- **Depends on:** T-001 (app shell + Tailwind/daisyUI). **Blocks (soft):** the polished
  versions of F-003 and F-004 (icons on card faces, mono ids, code legibility) — those
  features can start before this and adopt it when it lands.

## Out of scope

A full design-token system, theming beyond the existing light/dark daisyUI themes, an
in-app font picker (a later option per ADR-009), and choosing icons for specific UI — this
task sets up the primitives, features use them.

## References

ADR-005, ADR-009; `docs/04-TECH_STACK.md`; `apps/web/src/styles.css`; `apps/web/AGENTS.md`.
