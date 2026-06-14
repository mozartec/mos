---
created: 2026-06-11T23:00:00Z
updated: 2026-06-14T00:02:12Z
---

# Design system — Ink & Highlight

The visual language of the mos app. This doc is the spec the web app implements (F-018
and everything after it); when the app and this doc disagree, fix one of them — don't let
them drift. The decision behind the direction is ADR-016.

## Direction

mos renders markdown — ink on paper. The design leans into that instead of borrowing
another dev tool's look:

- **The wiki reads like a document.** Paper-warm surfaces, serif prose, generous measure.
- **The board works like an instrument.** Dense, crisp, monospace ids, hairline borders.
- **One accent: highlighter amber.** The color you mark text with. It appears where
  attention belongs — the primary action, the active state, the current sprint — and
  nowhere else.

Two themes, both first-class: **`mos-paper`** (light) and **`mos-carbon`** (dark). Same
personality, inverted substrate. No other themes ship.

## Typography

Self-hosted via Fontsource (the existing pattern in `apps/web/src/styles.css` — no CDN at
runtime).

| Role | Face | Weights | Used for |
| --- | --- | --- | --- |
| UI / body | **IBM Plex Sans** | 400 / 500 / 600 | everything interactive: navigation, board, lists, chips, forms |
| Code / ids | **IBM Plex Mono** | 400 / 500 | card ids, frontmatter values, timestamps, code blocks, `kbd` |
| Prose | **Newsreader** | 400 / 500 (+ italics) | rendered markdown body in wiki/reader/card pages only |

Rules:

- Plex Sans is the `--font-sans` default; Newsreader applies **only inside rendered
  markdown prose** (the `prose` container), never to UI chrome. Headings inside prose stay
  Plex Sans 600 so documents and UI share one skeleton.
- Ids (`F-004`, `T-010`) are always Plex Mono, medium, slightly tracked — they are the
  product's serial numbers and should read as such.
- UI default size is 14px (`text-sm`); board card metadata may drop to 12–13px; prose is
  16–17px with `max-w-prose` measure.

## Color

All UI color goes through daisyUI semantic tokens (`base-*`, `primary`, `neutral`,
`info`…), never raw Tailwind palette names — with one sanctioned exception, the curated
card-color ramp (see below). Tokens follow daisyUI color rules: `base-*` carries the
page, `primary` appears once per view, status colors mean status.

### `mos-paper` (light, default)

```css
@plugin 'daisyui/theme' {
  name: 'mos-paper';
  default: true;
  prefersdark: false;
  color-scheme: 'light';
  --color-base-100: oklch(98.5% 0.006 90);
  --color-base-200: oklch(96% 0.008 90);
  --color-base-300: oklch(92.5% 0.01 90);
  --color-base-content: oklch(24% 0.012 75);
  --color-primary: oklch(76% 0.14 78);
  --color-primary-content: oklch(27% 0.06 78);
  --color-secondary: oklch(30% 0.015 75);
  --color-secondary-content: oklch(97% 0.005 90);
  --color-accent: oklch(52% 0.09 210);
  --color-accent-content: oklch(98% 0.01 210);
  --color-neutral: oklch(32% 0.012 75);
  --color-neutral-content: oklch(96% 0.008 90);
  --color-info: oklch(53% 0.13 245);
  --color-info-content: oklch(97% 0.01 245);
  --color-success: oklch(51% 0.12 150);
  --color-success-content: oklch(97% 0.01 150);
  --color-warning: oklch(64% 0.16 50);
  --color-warning-content: oklch(20% 0.04 50);
  --color-error: oklch(55% 0.19 25);
  --color-error-content: oklch(97% 0.01 25);
  --radius-selector: 0.25rem;
  --radius-field: 0.25rem;
  --radius-box: 0.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 1;
}
```

### `mos-carbon` (dark)

```css
@plugin 'daisyui/theme' {
  name: 'mos-carbon';
  default: false;
  prefersdark: true;
  color-scheme: 'dark';
  --color-base-100: oklch(21% 0.008 75);
  --color-base-200: oklch(18.5% 0.008 75);
  --color-base-300: oklch(16% 0.008 75);
  --color-base-content: oklch(91% 0.012 85);
  --color-primary: oklch(80% 0.14 80);
  --color-primary-content: oklch(24% 0.06 80);
  --color-secondary: oklch(90% 0.012 85);
  --color-secondary-content: oklch(20% 0.01 75);
  --color-accent: oklch(72% 0.1 200);
  --color-accent-content: oklch(18% 0.02 200);
  --color-neutral: oklch(28% 0.01 75);
  --color-neutral-content: oklch(92% 0.01 85);
  --color-info: oklch(70% 0.12 245);
  --color-info-content: oklch(18% 0.03 245);
  --color-success: oklch(72% 0.13 150);
  --color-success-content: oklch(18% 0.03 150);
  --color-warning: oklch(75% 0.15 55);
  --color-warning-content: oklch(20% 0.04 55);
  --color-error: oklch(68% 0.17 25);
  --color-error-content: oklch(16% 0.03 25);
  --radius-selector: 0.25rem;
  --radius-field: 0.25rem;
  --radius-box: 0.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}
```

Token intent, in words: warm hues throughout (hue 75–90 — paper and ink, not blue-gray);
amber `primary` is the highlighter; `secondary` is solid ink (the quiet strong button);
`accent` is a restrained teal reserved for graph emphasis (critical path, ready set);
`warning` sits at burnt orange so it never reads as the amber brand.

### The dark variant is the theme, not the OS

Tailwind's default `dark:` variant keys on `prefers-color-scheme` — but the app's theme is
`data-theme`, chosen by the in-app toggle. Those can disagree (OS light + app dark), which
today renders light-mode card colors on dark surfaces. The system therefore re-keys the
variant once, globally:

```css
@custom-variant dark (&:where([data-theme='mos-carbon'], [data-theme='mos-carbon'] *));
```

After that, `dark:` utilities follow the toggle. Semantic tokens never need `dark:` at
all — this exists only for the card-color ramp.

### The curated card-color ramp (the one exception)

Vault configs name card colors from the curated set (`05-VAULT_SPEC.md` §5b: `slate`,
`red`, … `pink`). These are data-driven identity colors — a vault's "feature = purple" must
look purple in both themes — so they keep using raw Tailwind ramps, centralized in one
mapping (`card-style.ts`), always as a light+`dark:` pair, relying on the theme-keyed
variant above. Raw palette classes anywhere else in the app are a defect; everything else
uses semantic tokens.

## Shape, depth, density

- **Radius:** boxes 0.5rem, fields/selectors 0.25rem — crisp, not bubbly.
- **Borders:** 1px hairlines (`border-base-300` on light surfaces, `border-base-content/8`
  on raised ones) do the separating; shadows are reserved for true elevation (peek panel,
  dropdowns, dragged card). `--depth: 1` gives components their subtle lift.
- **Noise:** on in `mos-paper` only — the paper grain; carbon stays clean.
- **Surfaces:** page is `base-100`; board columns are `base-200` wells; cards are
  `base-100` on those wells with a hairline border, so the board reads as paper cards in
  trays rather than gray-on-gray. Elevation order never inverts.
- **Density:** the board and lists are compact by default (Linear-grade) — 8px card
  padding steps, 12–13px metadata, 14px titles. The wiki keeps generous spacing.

## Motion

- Micro-interactions (hover raise, chip fades, column highlight): 150ms ease-out,
  transform/opacity only.
- The card peek slides in over 240ms `cubic-bezier(0.32, 0.72, 0, 1)` with a scrim fade;
  closing is faster (180ms).
- A view's initial load may stagger column/list reveals once (≤300ms total); no looping or
  scroll-triggered animation anywhere — this is a tool, not a landing page.
- Everything honors `prefers-reduced-motion: reduce` by collapsing to opacity changes.

## Components (daisyUI idioms)

- **Navigation:** the navbar brand is the **vault's name** from `.mos/config.json`
  (`vault.name`) in Plex Sans 600 — the product recedes, the vault is the star; "mos"
  remains as the small mark next to the theme toggle. Lenses (Wiki · Board · Cards ·
  Graph) are daisyUI `tabs` (boxed style), not `join`ed buttons.
- **Buttons:** default `btn` is quiet (`btn-ghost`/outline on base); `btn-primary` (amber)
  appears at most once per view. Destructive actions (future write mode) use `btn-error`.
- **Badges/chips:** card type badges and enum chips are `badge-soft` at `badge-sm`/`xs`;
  blocked is `badge-error` (no pulse animation — a board full of pulsing chips is noise).
- **Parallel-batch overlays (F-026, ADR-021):** two derived states the board and graph
  surface so the orchestrator sees parallel safety without asking. Both are computed by
  pure core selectors (`inFlightCollisions`, `safeToStart`) and appear only when the vault
  declares `areas` — a vault without them renders exactly as before.
  - **Collision badge.** A card in the in-flight column that shares a declared `touches`
    area with another in-flight card carries a `badge-warning` (the burnt-orange alert
    tone, like `blocked`'s prominence but not error) with the `git-merge` glyph and the
    overlapping area name(s); its `title` names the colliding card(s). On the graph, the
    same is a small warning triangle on the node with the names in its `<title>`.
  - **Safe-to-start highlight.** A ready card whose surface is disjoint from every
    in-flight card gets a subtle `accent` ring (`ring-1 ring-accent/50`) and a
    `badge-soft badge-accent` "Safe to start" chip with the `bolt` glyph — `accent` because
    it is the board echo of the graph's accent-toned ready set. On the graph, the ready dot
    splits: solid `accent` when safe, hollow (`fill-none stroke-accent`) when ready but its
    surface isn't clear of in-flight work. The legend gains matching entries.
- **Selects/filters:** filter bars use small ghost `select`/`filter` components in one
  row, mono values where the value is an id or sprint name.
- **Focus:** every interactive element keeps a visible 2px focus ring
  (`outline-offset: 2px`, base-content at 60%); never `outline: none` without a
  replacement.

## Accessibility

WCAG AA is the floor, enforced in review (apps/web `AGENTS.md`): AXE-clean views, 4.5:1
contrast for text (the token pairs above are chosen to pass — verify when adjusting),
focus management on overlay open/close (trap, restore), `aria-current` on active lens and
sprint, and full keyboard reach for everything pointer-reachable.
