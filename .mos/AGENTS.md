# mos framework guide

This is the portable manual for operating a **mos** vault. It is repo-agnostic: it
describes mos itself, not this particular project. Whatever else a vault adds, this is the
shared baseline a cold agent can read once and operate from, together with
`.mos/config.json`. Project-specific rules live in the host's root `AGENTS.md`, not here.

Targets **vault spec version 0.4.** The spec is the formal data contract; this
guide is the operator's manual. They are deliberately split so they don't drift into two
truths: anything about the *format* (exact fields, validation, glob dialect) is owned by
the spec — see your mos docs' `VAULT_SPEC` — and this guide points there rather than
restating it. This guide owns *how to operate*.

## What mos is

mos renders a folder of markdown as a wiki and a Kanban board. The **folder is the source
of truth**; mos is **read-only** — it never writes the vault. Cards are created and updated
by an agent (you), guided by this file and the vault's `AGENTS.md`. There is no database;
`.mos/` holds config plus rebuildable cache.

## The three lenses

mos is read-only views over one folder; they are independent:

- **Board** — scans for *cards* and lays them out in columns by state. One card = one file.
- **Wiki** — renders any markdown file and makes references between files clickable.
  Ignores types and states; its job is browsing and reading.
- **Graph** — the same cards and links seen as a dependency/reference graph.

## Cards, types, states, columns

- A **card** is one markdown file in a board-scanned folder (`board/` by convention) whose
  frontmatter declares a `type` the config recognizes. Folder = scope; `type` =
  behavior. A note in that folder with no recognized `type` is *not* a card. A card's
  identity is its `id`, never its path, so files rename safely.
- A **type** declares its **states**, its **parent** rule, and the **fields** shown on the
  card face. Nesting is one level (a type may have `parent: <other-type>`).
- A **state** is a status a card of that type may hold; each maps to a board **column** (or
  to nothing, meaning "valid status, hidden from the board").
- A **column** is what you see on the board. Several states can map to one column.

**Config drives all of it.** Types, states, columns, and field definitions come from
`.mos/config.json` — never invent a value that isn't declared there. `status` must be one
of the card type's states. mos hardcodes no `F-`/`T-` scheme, no fixed columns, no type
names: a vault defines its own vocabulary.

Required card frontmatter: `id`, `type`, `title`, `status`. Optional fields
(`priority`, `owner`, `parent`, `dependsOn`, `touches`, timestamps, …) are typed by
the config's field registry and shown per the type's `card.fields`.

## Areas & touches, parallel batches

- **Areas** are vault-defined names for file surfaces, mapped to globs in config's
  `areas`. The names are the vocabulary; the globs say what each means here.
- **`touches`** is a card field listing the areas the work expects to modify
  (`touches: [core, docs]`). Fill it at planning time from the card's own plan, and keep
  it honest when scope changes — a stale declaration silently poisons planning.
- A **parallel batch** is a set of *ready* cards (every dependency done) whose `touches`
  are **pairwise disjoint** — unblocked *and* collision-free, so they can run at once. A
  card with no `touches` is set aside (surface unknown); an explicit `touches: []`
  declares "touches nothing" and batches with anything.

`dependsOn` captures logical order; `touches` captures physical surface. Both matter:
two unblocked cards can still collide if they edit the same files.

## Write conventions

You are the write path; mos only reads. The rules:

1. **Config is the vocabulary.** Use only types, states, and columns config declares.
2. **Ids are unique and stable** — never reused once assigned; if a card is dropped, leave
   its id reserved.
3. **Edit frontmatter only — never rewrite a card's prose body** once it has left its
   initial state. Move a card by changing `status`. The one allowed prose edit is ticking
   a finished card's own `## Acceptance` checkboxes on ship. (Reshaping a card still in
   its type's *initial* state — refinement — is the deliberate exception; see your docs.)
4. **Timestamps are yours.** Set `created` and `updated` on create; bump `updated` on
   every frontmatter edit; leave `created` alone. Always **ISO 8601 UTC with a `Z`
   suffix** (`2026-06-08T09:00:00Z`) — never a local time or offset. mos never writes
   them. (Field names are configurable via `meta.timestamps`.)
5. **Emit frontmatter in the vault's canonical order** — the config's `fieldOrder` when
   present, else the spec's documented default. Order never affects rendering, but the
   validator warns on deviation.

After changing cards, reload the board (`mos serve`) or run `mos validate` to confirm
every card still lands in a column and references resolve.

## Versioning

mos has three independently versioned axes; keep them distinct:

- **Spec version** — the vault *format* contract (this vault targets **0.4**),
  declared as `specVersion` in `.mos/config.json`. It is versioned separately from the
  tool because vaults depend on the format. Bumped only when the format itself changes; new
  format features are additive, so a vault on an older spec stays valid.
- **CLI / app version** — the mos tool that reads the vault, versioned on its own track
  (SemVer). The tool **states which spec versions it supports**; a tool reads any vault
  whose `specVersion` falls in that supported range. Upgrading the tool does not force a
  vault to change its `specVersion`.
- **Skills version** — the agent skills that operate a vault are **self-contained**: they
  gate only on `.mos/config.json` and carry their own versions. They may *reference* this
  guide as extra context but never *require* it, so hand-made or older-init vaults that
  lack it still work.

The spec is the floor everything else builds on. When in doubt about the format, the spec
wins; when in doubt about how to operate, this guide wins.

## The formal contract lives in the spec

This guide intentionally does **not** restate exact field lists, validation rules, the glob
dialect, or link-resolution semantics — those are the spec's job (your mos docs'
`VAULT_SPEC`, targeting version 0.4). Read it when you need the precise format;
read this guide for how to operate day to day.
