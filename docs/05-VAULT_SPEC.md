---
created: 2026-06-07T13:00:00Z
updated: 2026-06-14T00:45:00Z
---

# Vault spec

This is the data contract. A **vault** is a folder mos can open. This document defines
the format; [`/.mos/config.json`](../.mos/config.json) and [`/board`](../board) in this
repo are a living implementation of it.

## 0. Spec version

The current vault format is **spec version `0.4`**. It is versioned separately from the
mos app, because the format is a contract that vaults depend on. Each vault declares the
version it targets via `specVersion` in `.mos/config.json`, and the app states which spec
versions it supports. Bump this only when the format itself changes. See
[`11-RELEASING.md`](11-RELEASING.md) for the versioning policy.

`0.2` adds an optional **field-types registry** (§5a) and **created/updated timestamps**
(§4a). `0.3` adds an optional **card-color palette and icon set** (§5b): a type may set a
`color`, and a field may set an `icon` or per-value `valueColors`. `0.4` adds two optional
features. **Areas & touches** (§5c,
[ADR-021](08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)):
an `areas` config map of vault-defined names to glob lists, a `touches` list field in
which a card declares the areas it expects to modify, and enum `source`s that may name a
config map as well as a list (§5a). **Board scope** (§5d,
[ADR-020](08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint)):
a `board.scopeField` that scopes the board by a vault-named enum (sprint, cycle, …) whose
values may carry dates, plus the backlog of unscheduled cards. All of these are purely
additive: a vault on an earlier version that declares none of them is still valid, and
every new key is optional, so nothing breaks if it's absent — a 0.3 vault's string
`sprints` is even read as a `sprint` scope for compatibility (§5d).

## 1. Two lenses over one folder

mos is two read-only views over the same vault, and they're independent:

- **Wiki** — renders any markdown file and makes references clickable. Ignores types and
  states. A wiki file may carry optional frontmatter (e.g. `created`/`updated`, §4a); the
  wiki strips the frontmatter block from the rendered body and may show it as metadata.
  Job: browsing and reading.
- **Board** — scans for *cards* and lays them out in columns by state. A card is one file.
  Clicking a card opens it in the wiki renderer (one renderer, no duplication).

## 2. Folder layout

```
my-vault/
├── .mos/
│   └── config.json        # types, columns, field mappings
├── docs/                  # wiki-only reference (not cards)
├── board/                 # board scan scope — cards live here
│   ├── F-001-some-feature.md
│   ├── F-001-S-01-a-story.md
│   └── T-001-a-task.md
├── AGENTS.md              # how an AI assistant creates/updates cards
└── README.md
```

Folder names are conventional, not fixed — the config globs decide what is scanned.

## 3. What qualifies as a card

A file is a card if, and only if, **both** are true:

1. it is inside a board scan path (`board.include` globs), and
2. its frontmatter declares a `type` the config recognizes.

Everything else is wiki-only. A note dropped in `board/` with no recognized `type` is not
a card (mos may surface it as "not a card" rather than silently ignoring it). Folder =
scope; frontmatter `type` = behavior. Card identity is the `id`, never the path, so files
can be renamed safely.

## 4. Card frontmatter

```markdown
---
id: F-001-S-02
type: story
title: Resolve and navigate links
status: In Progress
priority: P0
owner: mozart
sprint: S1
parent: F-001        # only for types that allow a parent
estimate: M
dependsOn: [T-001, F-002-S-01]
created: 2026-06-07T13:00:00Z
updated: 2026-06-08T09:00:00Z
---

# F-001-S-02 — Resolve and navigate links

Freeform body. mos never rewrites this; only frontmatter is machine-managed.
```

- `id` — stable, unique. Identity of the card.
- `type` — must match a key under `types` in config.
- `status` — must be one of the states that type allows.
- `title` — display name; falls back to the first H1.
- `parent` — an `id`, allowed only if the type permits it (see §5).
- `dependsOn` — a list of `id`s this card depends on. One direction only; `blocks` is
  derived by scanning all cards' `dependsOn` lists (never stored). Used by scripts, the
  board, and the graph lens.
- `touches` — a list of area names this card expects to modify (§5c).
- `created` / `updated` — optional audit timestamps (§4a).
- other fields (`priority`, `owner`, `sprint`, `estimate`, `phase`, ...) — optional, shown
  on the card per the type's `card.fields`, and typed by the field registry (§5a). Unknown
  keys are allowed and ignored by the board.

## 4a. Timestamps (`created` / `updated`)

Every card — and optionally every wiki doc — may carry two timestamps recording when the
file was first created and last changed. They live in frontmatter rather than relying on git
because history gets rewritten (squash-merge, rebase) and a vault must be readable as plain
files with no git at all (ADR-001). See ADR-010.

- **Type `datetime`**, ISO 8601, UTC recommended (e.g. `2026-06-08T09:00:00Z`).
- **Default names `created` and `updated`**, but the names are configurable per vault via
  `meta.timestamps` (`createdField` / `updatedField`) in `config.json`, so a vault can use
  `added`/`modified` or localized names instead.
- **Optional and non-breaking.** A file missing one or both is valid; the app simply doesn't
  show or sort by what isn't there. This matters most for docs, which often won't have them.
- **Agent-maintained, app-read-only (ADR-002).** Whoever creates a card sets both; any
  frontmatter edit bumps `updated`. The app reads, displays (relative + absolute), and may
  sort by them, but never writes them.

## 5. The type system

A type declares three things: its **states** (and the column each maps to), its **parent**
rule, and the **fields** shown on the card face.

Nesting is **one level only** for now: a type may set `parent: "<other-type>"`, and that
other type must have `parent: null`. So `story → feature` is allowed; chains are not. mos
validates this on load.

A state may map to `null`, meaning "valid status, hidden from the board" (e.g. `Deferred`,
`Dropped`). Multiple states may map to one column (e.g. `Blocked` → `In Progress`).

A type may also set an optional **`color`** — a name from the curated palette (§5b) — used
as the card's accent and type badge. It's optional and config-driven: mos never colors a
type by its name, so a vault's own types (`epic`, `bug`, `chore`, ...) style themselves.

## 5a. Field types

The optional top-level `fields` registry gives a frontmatter field a **data type**, so mos
knows how to render, validate, and sort it instead of treating every value as a string. A
`card.fields` (or `wiki.fields`) entry that has no registry entry defaults to `string`, so
the registry is purely additive — omit it entirely and everything still works.

| Type | Meaning | Example |
|---|---|---|
| `string` | Plain text (the default). | `owner: mozart` |
| `enum` | One of a fixed set, via `values: [...]` or `source: "<configKey>"` — a config list whose entries are the values (e.g. `sprints`), or a config map whose keys are (e.g. `areas`). | `priority: P1` |
| `id` | A card/doc id; resolvable like a reference (§7). | `parent: F-001` |
| `date` | A calendar date, ISO `YYYY-MM-DD`. | `due: 2026-07-01` |
| `datetime` | A date+time, ISO 8601 (§4a). | `updated: 2026-06-08T09:00:00Z` |

### List modifier

Any field type can carry `"list": true` to indicate the frontmatter value is a YAML list of
that type rather than a single value. In YAML, list values use the inline `[a, b]` or block
`- a` syntax. A field without `"list"` (or with `"list": false`) expects a single value.

```jsonc
"dependsOn": { "type": "id", "list": true, "label": "Depends on" }
```

```yaml
# in a card's frontmatter:
dependsOn: [F-001-S-02, F-002-S-01]
```

### Field icons and enum colors

A field may carry two optional presentation hints, both drawn from curated sets (§5b) so the
face stays config-driven and theme-independent:

- **`icon`** — a glyph name from the icon set, shown beside the field on the card.
- **`valueColors`** — for an `enum` field, a map of value → palette color, so each value
  renders as a colored chip (e.g. `P0` red, `P3` slate). Values with no entry fall back to a
  neutral chip.

```jsonc
"priority": {
  "type": "enum",
  "values": ["P0", "P1", "P2", "P3"],
  "label": "Priority",
  "icon": "flag",
  "valueColors": { "P0": "red", "P1": "amber", "P2": "blue", "P3": "slate" }
}
```

### Registry example

```jsonc
"fields": {
  "priority":  { "type": "enum", "values": ["P0", "P1", "P2", "P3"], "label": "Priority" },
  "sprint":    { "type": "enum", "source": "sprints" },
  "dependsOn": { "type": "id", "list": true, "label": "Depends on" },
  "created":   { "type": "datetime", "label": "Created" },
  "updated":   { "type": "datetime", "label": "Updated" }
}
```

Validation is **best-effort and non-fatal**: a value that doesn't match its declared type is
reported as a diagnostic, not a crash, and the card still renders. An optional `label` sets
the display name on the card face; it falls back to the field key.

## 5b. Card colors and icons

To style cards without hardcoding type names or asking authors for CSS, mos defines two small
curated sets. A config value must be one of these names (validated on load); the app maps
each name to concrete styles, so the same config renders consistently across themes. These
are deliberately **not** daisyUI intent tokens (`primary`/`info`/...) — a card color names a
fixed hue for categorization, not a UI role. The sets are intentionally small and may grow in
a future spec version.

**Colors** (`color`, `valueColors`):

```
slate · red · orange · amber · green · teal · blue · indigo · purple · pink
```

**Icons** (`icon`):

```
user · calendar · flag · hourglass · clock · git-commit · tag · target · stack · bookmark
```

Where they apply:

- **`color`** on a **type** — the card's accent and type badge.
- **`icon`** on a **field** — a glyph beside the field on the card face.
- **`valueColors`** on an **enum field** — a colored chip per value.

All three are optional; a vault that sets none renders with neutral defaults.

## 5c. Areas & touches (declared file surfaces)

`dependsOn` captures logical order; it says nothing about which files a card will change,
so two unblocked cards can still rewrite the same code. Spec `0.4` adds the physical
counterpart
([ADR-021](08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)):

- **`areas`** — an optional top-level config map of vault-defined names to glob lists
  (vault-relative, same glob dialect as `board.include`):

  ```jsonc
  "areas": {
    "core": ["packages/core/**"],
    "web":  ["apps/web/**"],
    "docs": ["docs/**", "*.md"]
  }
  ```

  The names are the vocabulary; the globs say what each name means in this vault. Two
  rules keep areas useful rather than decorative:

  - **Non-overlapping globs.** Tooling compares declarations by *name*, so two
    differently-named areas whose globs match the same file defeat the point.
  - **Size by merge risk.** An area should be the unit at which "two cards share it"
    means "their edits might actually conflict." This is the rule that gets missed:
    areas that are too coarse — one per app, or one per *layer* (`domain`, `ui`) — make
    independent work look collinear and collapse every batch to a single card, so the
    feature quietly does nothing; areas that are too fine add bookkeeping without buying
    parallelism. A small repo is often fine with one area per package (`core`, `web`,
    `docs`, as above). Larger repos converge on two kinds:
      - **hub areas** — narrow, whole-file or regenerated *trunk* surfaces where any two
        concurrent edits conflict by construction: an ORM migration snapshot, the DI /
        composition root, a permission or command catalog, a route manifest. Each is
        effectively exclusive — at most one card in a batch should hold it.
      - **module areas** — one per feature, spanning that feature across *all* layers
        (domain, service, API, UI, tests), not one layer across all features. Two
        different modules are then genuinely disjoint and batch freely.

    Carve hub files out of any module glob that would otherwise swallow them — a hub
    area is the more specific claim and wins. (A larger app might pair hub areas like
    `db-migrations`, `di-root`, `routes` with module areas like `billing`, `inventory`.)

- **`touches`** — a list field in which a card names the areas it expects to modify
  (`touches: [core, docs]`). Register it as a list `enum` sourced from `areas` (§5a) so
  values are validated against the configured names. Like every card write, it's
  agent-maintained: the writing agent fills it at planning time and keeps it honest when
  scope changes (ADR-002); the app only reads it.

A **parallel batch** is a set of *ready* cards — every dependency done — whose `touches`
are **pairwise disjoint**: work that is both unblocked and collision-free. Batch
computation is a pure core function (`parallelBatch`). A missing `touches` is not a claim:
such a card's surface is unknown and it is set aside rather than batched, while an explicit
empty list (`touches: []`) declares "touches nothing" and batches with anything.

Validation: a `touches` entry that names no configured area is flagged, and two cards
concurrently in flight (in the column before the last — the counterpart of "last column
is done") that declare overlapping areas draw a warning. This in-flight column is
positional: the single column before the last, so a board with several active columns
between backlog and done detects only the last of them (and treats the rest as queued) —
naming the in-flight column(s) in config is the eventual fix (F-028). Everything here is
additive: a vault with no `areas` and no `touches` validates and renders exactly as
before, and batch computation degrades to the plain ready set. Verifying declarations
against actual git diffs is deliberately out of spec for now (ADR-021).

## 5d. Board scope (a config-named grouping)

The board renders **one scope at a time** — a vault-named grouping such as a sprint,
cycle, or iteration — rather than every card at once
([ADR-020](08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint)).
Scope is opt-in and config-driven: a vault that declares none gets an unscoped board with
no scope UI, exactly as before.

- **`board.scopeField`** designates an **enum** field (§5a) as the scope, e.g.
  `"scopeField": "sprint"`. The board shows that field's values one at a time, with a
  switcher (a picker plus prev/next) in the header.
- **Scope values** are that enum's values — plain strings, or **dated objects**
  `{ "name", "starts"?, "ends"? }` (ISO `YYYY-MM-DD`, UTC), declared inline in the field's
  `values` or supplied by a `source` list. With dates, the board opens on the value whose
  window contains today and shows the days remaining; without, it falls back to the last
  value with unfinished cards, then the user's last selection. The clock is never read
  inside the core — current-scope resolution is a pure function with `now` as an input
  ([ADR-001](08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)).
- **Backlog** is the scope's sibling view: the cards with an **empty scope value** that
  are **not done** — unscheduled but live work — shown as a priority-ranked list reachable
  from the header. It exists only for scoped vaults, and is *not* the same as a "Backlog"
  *column* (which is a plain status mapping, §5).
- **Filters** — a config-driven filter bar (the card type, the registry's enum and
  card-face fields, and free text) sits above both the board and the backlog; selections
  persist in the URL so a filtered view is bookmarkable.

```jsonc
"board": {
  "include": ["board/**/*.md"],
  "columns": ["Backlog", "Planned", "In Progress", "Done"],
  "scopeField": "sprint"            // the enum field that scopes the board
},
"fields": {
  "sprint": { "type": "enum", "source": "sprints", "icon": "calendar" }
},
"sprints": [                        // string or dated { name, starts?, ends? }
  { "name": "S1", "starts": "2026-06-01", "ends": "2026-06-14" },
  { "name": "S2", "starts": "2026-06-15", "ends": "2026-06-28" }
]
```

**Backward compatible.** A 0.3 vault that lists string `sprints` and sets no `scopeField`
is read as a `sprint`-scoped vault (the alias); new vaults use `scopeField`. The validator
accepts strings and dated objects in either form, flags a malformed or inverted date, and
warns on overlapping windows.

## 6. config.json

```jsonc
{
  "specVersion": "0.4",
  "vault": { "name": "My Project" },

  // optional: maps the two timestamp roles to frontmatter field names (defaults shown)
  "meta": { "timestamps": { "createdField": "created", "updatedField": "updated" } },

  // optional: types for frontmatter fields (§5a). Omit for all-string behavior.
  // `icon` / `valueColors` are optional presentation hints from the curated sets (§5b).
  "fields": {
    "priority":  { "type": "enum", "values": ["P0", "P1", "P2", "P3"],
                   "icon": "flag",
                   "valueColors": { "P0": "red", "P1": "amber", "P2": "blue", "P3": "slate" } },
    "sprint":    { "type": "enum", "source": "sprints", "icon": "calendar" },
    "owner":     { "type": "string", "label": "Owner", "icon": "user" },
    "dependsOn": { "type": "id", "list": true, "label": "Depends on", "icon": "git-commit" },
    "touches":   { "type": "enum", "source": "areas", "list": true, "label": "Touches", "icon": "stack" },
    "created":   { "type": "datetime", "label": "Created", "icon": "clock" },
    "updated":   { "type": "datetime", "label": "Updated", "icon": "clock" }
  },

  // optional: vault-defined file surfaces for parallel planning (§5c).
  "areas": {
    "core": ["packages/core/**"],
    "web":  ["apps/web/**"],
    "docs": ["docs/**", "*.md"]
  },

  // optional: canonical frontmatter property order for the write path (F-013).
  // The app reads frontmatter as a map — order never affects rendering — but
  // agents/scripts emit properties in this order, and the validator warns
  // (non-fatally) when a card deviates. When omitted, this default applies:
  //   id, type, title, status, priority, phase, owner, sprint, parent,
  //   estimate, dependsOn, touches, created, updated
  // Properties not in the list go after the listed ones, in their own order.
  "fieldOrder": ["id", "type", "title", "status", "priority", "phase", "owner",
                 "sprint", "parent", "estimate", "dependsOn", "touches",
                 "created", "updated"],

  // optional: the folders (or files) the server watches for live reload,
  // vault-relative. An allowlist, not an ignore list — on big repos watching
  // everything delays change events by tens of seconds. `.mos/config.json` is
  // always watched in addition. When omitted, this default applies:
  "watch": ["board", "docs"],

  // wiki.fields: optional frontmatter a doc may carry (typed via the registry)
  "wiki":  { "include": ["**/*.md"], "exclude": [".mos/**", "AGENTS.md"],
             "fields": ["created", "updated"] },
  "board": {
    "include": ["board/**/*.md"],
    "columns": ["Backlog", "Planned", "In Progress", "Done"],
    "sortWithinColumn": ["priority", "id"],
    // optional: scope the board by an enum field (§5d). Omit for an unscoped board.
    "scopeField": "sprint"
  },
  "references": {
    "idPattern": "[A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*"
  },
  "types": {
    "feature": {
      "label": "Feature",
      "parent": null,
      "color": "purple",
      "states": { "Draft": "Backlog", "Planned": "Planned",
                  "In Progress": "In Progress", "Done": "Done",
                  "Deferred": null, "Dropped": null },
      "card": { "fields": ["id", "phase", "priority", "owner", "sprint", "dependsOn", "touches", "created", "updated"] }
    },
    "story": {
      "label": "Story",
      "parent": "feature",
      "color": "green",
      "states": { "Todo": "Backlog", "Planned": "Planned",
                  "In Progress": "In Progress", "Blocked": "In Progress", "Done": "Done" },
      "card": { "fields": ["id", "parent", "priority", "owner", "sprint", "estimate", "dependsOn", "touches", "created", "updated"] }
    },
    "task": {
      "label": "Task",
      "parent": null,
      "color": "blue",
      "states": { "Todo": "Backlog", "Planned": "Planned",
                  "In Progress": "In Progress", "Done": "Done", "Deferred": null },
      "card": { "fields": ["id", "phase", "priority", "owner", "sprint", "dependsOn", "touches", "created", "updated"] }
    }
  },
  // the scope vocabulary (§5d): plain strings, or dated { name, starts?, ends? }
  "sprints": [
    { "name": "S1", "starts": "2026-06-01", "ends": "2026-06-14" },
    { "name": "S2", "starts": "2026-06-15", "ends": "2026-06-28" },
    { "name": "S3", "starts": "2026-06-29", "ends": "2026-07-12" }
  ]
}
```

## 7. Link resolution

The wiki resolves these to the right file, whether or not a real link exists:

1. markdown links: `[F-001](../board/F-001-some-feature.md)`
2. bare id mentions: `see F-001`, `depends on T-002`
3. (optional) `[[F-001]]`

Resolution is by `id`, so links survive renames. The id shape comes from
`references.idPattern` in config, so it isn't locked to the `F-`/`T-` style this repo uses.

### Relative-path links

Ordinary markdown links to vault files navigate in-app (F-017). The contract is **GitHub
compatibility**: a relative link written the way GitHub renders it works in mos with no
special syntax, and a form mos can't navigate degrades to an inert, visibly dimmed token —
never a 404. The rules:

- The href resolves against the **current file's folder**, honoring `./` and `../`
  (`05-VAULT_SPEC.md` from a sibling doc, `../docs/03-ARCHITECTURE.md` from a board card).
  A leading `/` resolves from the vault root.
- `#fragment` and `?query` suffixes are stripped before resolving; percent-escapes are
  decoded (`my%20notes.md`). In-page `#heading`-only anchors are not navigations and
  render inert.
- The resolved path must match a file in the vault's **listing** (wiki-scope files and
  cards), case-exactly. Resolution never assumes folder names — any `wiki`/`board` layout
  the config defines works the same way.
- A path that escapes the vault root (`../../…`), points at a missing file, or uses an
  unsupported scheme renders inert, like an unresolved id reference.
- External links (`http://`, `https://`, `mailto:`) open in a new tab with
  `rel="noopener noreferrer"`.

Path resolution is pure core (`resolveRelativeLink`, ADR-001); the app only applies it to
the rendered DOM.

## 8. Writes happen via the agent

mos is read-only. Cards are created and updated by an AI assistant guided by the vault's
`AGENTS.md`, which restates this spec as instructions and enforces "edit frontmatter only,
never rewrite prose." An optional MCP server can centralize safe writes later. See
[`08-DECISIONS.md`](08-DECISIONS.md) (ADR-002).

## 9. Not in V1 (captured so the ideas aren't lost)

- **Malformed-card lane** — surface broken/unrecognized cards in a "needs fixing" lane
  rather than crashing; best-effort, can't always say *what's* wrong.
- **Date-based scheduling** — `due`/`start` dates and a calendar view; sprint codes suffice
  for now.
- **In-app editing** — not discarded, just later; will follow the frontmatter-only rule.
- **Sub-card nesting on the board** — showing a feature's child stories nested; `parent` is
  captured now so the data is ready.
- **Manual card ordering / drag** — inherently a write; deferred with editing.
