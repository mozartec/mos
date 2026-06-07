# Vault spec

This is the data contract. A **vault** is a folder mos can open. This document defines
the format; [`/.mos/config.json`](../.mos/config.json) and [`/board`](../board) in this
repo are a living implementation of it.

## 0. Spec version

The current vault format is **spec version `0.1`**. It is versioned separately from the
mos app, because the format is a contract that vaults depend on. Each vault declares the
version it targets via `specVersion` in `.mos/config.json`, and the app states which spec
versions it supports. Bump this only when the format itself changes. See
[`11-RELEASING.md`](11-RELEASING.md) for the versioning policy.

## 1. Two lenses over one folder

mos is two read-only views over the same vault, and they're independent:

- **Wiki** — renders any markdown file and makes references clickable. Ignores types and
  states. Job: browsing and reading.
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
---

# F-001-S-02 — Resolve and navigate links

Freeform body. mos never rewrites this; only frontmatter is machine-managed.
```

- `id` — stable, unique. Identity of the card.
- `type` — must match a key under `types` in config.
- `status` — must be one of the states that type allows.
- `title` — display name; falls back to the first H1.
- `parent` — an `id`, allowed only if the type permits it (see §5).
- other fields (`priority`, `owner`, `sprint`, `estimate`, `phase`, ...) — optional, shown
  on the card per the type's `card.fields`. Unknown keys are allowed and ignored by the
  board.

## 5. The type system

A type declares three things: its **states** (and the column each maps to), its **parent**
rule, and the **fields** shown on the card face.

Nesting is **one level only** for now: a type may set `parent: "<other-type>"`, and that
other type must have `parent: null`. So `story → feature` is allowed; chains are not. mos
validates this on load.

A state may map to `null`, meaning "valid status, hidden from the board" (e.g. `Deferred`,
`Dropped`). Multiple states may map to one column (e.g. `Blocked` → `In Progress`).

## 6. config.json

```jsonc
{
  "vault": { "name": "My Project" },
  "wiki":  { "include": ["**/*.md"], "exclude": [".mos/**", "AGENTS.md"] },
  "board": {
    "include": ["board/**/*.md"],
    "columns": ["Backlog", "Planned", "In Progress", "Done"],
    "sortWithinColumn": ["priority", "id"]
  },
  "types": {
    "feature": {
      "label": "Feature",
      "parent": null,
      "states": { "Draft": "Backlog", "Planned": "Planned",
                  "In Progress": "In Progress", "Done": "Done",
                  "Deferred": null, "Dropped": null },
      "card": { "fields": ["id", "phase", "priority", "owner", "sprint"] }
    },
    "story": {
      "label": "Story",
      "parent": "feature",
      "states": { "Todo": "Backlog", "Planned": "Planned",
                  "In Progress": "In Progress", "Blocked": "In Progress", "Done": "Done" },
      "card": { "fields": ["id", "parent", "priority", "owner", "sprint", "estimate"] }
    },
    "task": {
      "label": "Task",
      "parent": null,
      "states": { "Todo": "Backlog", "Planned": "Planned",
                  "In Progress": "In Progress", "Done": "Done", "Deferred": null },
      "card": { "fields": ["id", "phase", "priority", "owner", "sprint"] }
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

Resolution is by `id`, so links survive renames. The id shape is a configurable regex, so
it isn't locked to the `F-`/`T-` style this repo uses.

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
