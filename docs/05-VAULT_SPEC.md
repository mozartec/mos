---
created: 2026-06-07T13:00:00Z
updated: 2026-06-07T13:00:00Z
---

# Vault spec

This is the data contract. A **vault** is a folder mos can open. This document defines
the format; [`/.mos/config.json`](../.mos/config.json) and [`/board`](../board) in this
repo are a living implementation of it.

## 0. Spec version

The current vault format is **spec version `0.3`**. It is versioned separately from the
mos app, because the format is a contract that vaults depend on. Each vault declares the
version it targets via `specVersion` in `.mos/config.json`, and the app states which spec
versions it supports. Bump this only when the format itself changes. See
[`11-RELEASING.md`](11-RELEASING.md) for the versioning policy.

`0.2` adds an optional **field-types registry** (§5a) and **created/updated timestamps**
(§4a). `0.3` adds an optional **card-color palette and icon set** (§5b): a type may set a
`color`, and a field may set an `icon` or per-value `valueColors`. All of these are purely
additive: a `0.1`/`0.2` vault that declares none of them is still valid, and every new key
is optional, so nothing breaks if it's absent.

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
| `enum` | One of a fixed set, via `values: [...]` or `source: "<configKey>"` (e.g. `sprints`). | `priority: P1` |
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

## 6. config.json

```jsonc
{
  "specVersion": "0.3",
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
    "created":   { "type": "datetime", "label": "Created", "icon": "clock" },
    "updated":   { "type": "datetime", "label": "Updated", "icon": "clock" }
  },

  // wiki.fields: optional frontmatter a doc may carry (typed via the registry)
  "wiki":  { "include": ["**/*.md"], "exclude": [".mos/**", "AGENTS.md"],
             "fields": ["created", "updated"] },
  "board": {
    "include": ["board/**/*.md"],
    "columns": ["Backlog", "Planned", "In Progress", "Done"],
    "sortWithinColumn": ["priority", "id"]
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
      "card": { "fields": ["id", "phase", "priority", "owner", "sprint", "dependsOn", "created", "updated"] }
    },
    "story": {
      "label": "Story",
      "parent": "feature",
      "color": "green",
      "states": { "Todo": "Backlog", "Planned": "Planned",
                  "In Progress": "In Progress", "Blocked": "In Progress", "Done": "Done" },
      "card": { "fields": ["id", "parent", "priority", "owner", "sprint", "estimate", "dependsOn", "created", "updated"] }
    },
    "task": {
      "label": "Task",
      "parent": null,
      "color": "blue",
      "states": { "Todo": "Backlog", "Planned": "Planned",
                  "In Progress": "In Progress", "Done": "Done", "Deferred": null },
      "card": { "fields": ["id", "phase", "priority", "owner", "sprint", "dependsOn", "created", "updated"] }
    }
  },
  "sprints": ["S1", "S2", "S3"]
}
```

## 7. Link resolution

The wiki resolves these to the right file, whether or not a real link exists:

1. markdown links: `[F-001](../board/F-001-some-feature.md)`
2. bare id mentions: `see F-001`, `depends on T-002`
3. (optional) `[[F-001]]`

Resolution is by `id`, so links survive renames. The id shape comes from
`references.idPattern` in config, so it isn't locked to the `F-`/`T-` style this repo uses.

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
