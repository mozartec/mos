/**
 * `mos init` — turn a folder into a valid mos vault (F-016, ADR-013).
 *
 * Scaffolding, not runtime writes: this runs once to create a vault where none
 * exists. It refuses to touch an existing vault — no overwrite, no merge
 * (ADR-013) — and the serving app stays read-only (ADR-002).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/** The vault format version this scaffolder targets (config and framework guide share it). */
const SPEC_VERSION = '0.4';

/** ISO 8601 UTC without milliseconds — the vault timestamp convention. */
function isoNow(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function starterConfig(vaultName: string): string {
  const config = {
    specVersion: SPEC_VERSION,
    vault: { name: vaultName },
    meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
    fields: {
      id: { type: 'id', label: 'ID' },
      title: { type: 'string', label: 'Title' },
      status: { type: 'string', label: 'Status' },
      priority: {
        type: 'enum',
        values: ['P0', 'P1', 'P2', 'P3'],
        label: 'Priority',
        icon: 'flag',
        valueColors: { P0: 'red', P1: 'amber', P2: 'blue', P3: 'slate' },
      },
      owner: { type: 'string', label: 'Owner', icon: 'user' },
      parent: { type: 'id', label: 'Parent', icon: 'git-commit' },
      dependsOn: { type: 'id', list: true, label: 'Depends on', icon: 'git-commit' },
      created: { type: 'datetime', label: 'Created', icon: 'clock' },
      updated: { type: 'datetime', label: 'Updated', icon: 'clock' },
    },
    watch: ['board', 'docs'],
    wiki: {
      include: ['**/*.md'],
      exclude: ['.mos/**', 'AGENTS.md', 'node_modules/**'],
      fields: ['created', 'updated'],
    },
    board: {
      include: ['board/**/*.md'],
      columns: ['Backlog', 'In Progress', 'Done'],
      sortWithinColumn: ['priority', 'id'],
    },
    references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*' },
    types: {
      feature: {
        label: 'Feature',
        parent: null,
        color: 'purple',
        states: { Draft: 'Backlog', 'In Progress': 'In Progress', Done: 'Done', Dropped: null },
        card: { fields: ['id', 'priority', 'owner', 'dependsOn', 'created', 'updated'] },
      },
      task: {
        label: 'Task',
        parent: 'feature',
        color: 'blue',
        states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
        card: { fields: ['id', 'parent', 'priority', 'owner', 'dependsOn', 'created', 'updated'] },
      },
    },
    sprints: [],
  };
  return JSON.stringify(config, null, 2) + '\n';
}

function exampleCard(now: string): string {
  return `---
id: T-001
type: task
title: Explore the board
status: Todo
priority: P2
created: ${now}
updated: ${now}
---

# T-001 — Explore the board

A starter card showing the shape every card follows: YAML frontmatter on top (the data
the board reads), prose below (the context an agent or teammate executes from). Replace
it with real work once you've seen it move.

## Outcome

You've seen a card travel across the board and made the vault your own: your card types
and states in \`.mos/config.json\`, your write rules in \`AGENTS.md\`.

## Acceptance

- [ ] \`mos serve\` shows this card in the Backlog column.
- [ ] Changing \`status\` to \`In Progress\` (and bumping \`updated\`) moves it on the board.
- [ ] \`.mos/config.json\` reflects your project's own types, states, and columns.
`;
}

function agentsStub(vaultName: string): string {
  return `# AGENTS.md — managing the ${vaultName} vault

You are an AI assistant helping manage this project's backlog. This vault is a folder of
markdown rendered by **mos** as a board and wiki. You create and update **cards** here;
the mos app only reads them.

For how mos works in general — the lenses, what a card/type/state/column is, areas &
\`touches\`, parallel batches, and the versioning axes — read the portable framework guide
at [\`.mos/AGENTS.md\`](.mos/AGENTS.md). This file adds only what is specific to *this*
vault; the guide is the shared manual.

## What a card is

One markdown file under \`board/\`, named \`<id>-<slug>.md\`, whose frontmatter declares a
\`type\` defined in \`.mos/config.json\`. Required frontmatter: \`id\`, \`type\`, \`title\`,
\`status\`.

## The rules

1. **Types, states, and columns come from \`.mos/config.json\`** — never invent values
   that aren't there. \`status\` must be one of the card type's states.
2. **Ids are unique and stable**, never reused once assigned.
3. **Edit frontmatter only — never rewrite a card's prose body.** Move a card by changing
   \`status\`; the one allowed prose edit is ticking a finished card's own \`## Acceptance\`
   checkboxes.
4. **Timestamps are yours to maintain.** Set \`created\` and \`updated\` (ISO 8601 UTC,
   e.g. \`2026-06-10T09:00:00Z\`) when creating a card; bump \`updated\` on every edit.
   The app never writes them.
5. **Emit frontmatter in this order:** \`id\`, \`type\`, \`title\`, \`status\`, \`priority\`,
   \`owner\`, \`parent\`, \`dependsOn\`, \`created\`, \`updated\` — anything else after.

## Check your work

Reload the board (\`mos serve\`, or \`npx @mozartec/mos-cli serve\`) and confirm every card lands in
a column. A card that doesn't render means broken frontmatter — fix it before moving on.
`;
}

/**
 * The portable framework guide written to \`.mos/AGENTS.md\` (F-030). It is the canonical,
 * repo-agnostic answer to "what is mos and how do I operate this vault" — readable cold by
 * a mid-tier agent in any vault. It owns operating guidance; the formal data contract lives
 * in the spec (mos VAULT_SPEC), which it points at rather than restating. Nothing here is
 * specific to any one repo; vault-specific rules belong in the host's root \`AGENTS.md\`.
 */
function frameworkGuide(specVersion: string): string {
  return `# mos framework guide

This is the portable manual for operating a **mos** vault. It is repo-agnostic: it
describes mos itself, not this particular project. Whatever else a vault adds, this is the
shared baseline a cold agent can read once and operate from, together with
\`.mos/config.json\`. Project-specific rules live in the host's root \`AGENTS.md\`, not here.

Targets **vault spec version ${specVersion}.** The spec is the formal data contract; this
guide is the operator's manual. They are deliberately split so they don't drift into two
truths: anything about the *format* (exact fields, validation, glob dialect) is owned by
the spec — see your mos docs' \`VAULT_SPEC\` — and this guide points there rather than
restating it. This guide owns *how to operate*.

## What mos is

mos renders a folder of markdown as a wiki and a Kanban board. The **folder is the source
of truth**; mos is **read-only** — it never writes the vault. Cards are created and updated
by an agent (you), guided by this file and the vault's \`AGENTS.md\`. There is no database;
\`.mos/\` holds config plus rebuildable cache.

## The three lenses

mos is read-only views over one folder; they are independent:

- **Board** — scans for *cards* and lays them out in columns by state. One card = one file.
- **Wiki** — renders any markdown file and makes references between files clickable.
  Ignores types and states; its job is browsing and reading.
- **Graph** — the same cards and links seen as a dependency/reference graph.

## Cards, types, states, columns

- A **card** is one markdown file in a board-scanned folder (\`board/\` by convention) whose
  frontmatter declares a \`type\` the config recognizes. Folder = scope; \`type\` =
  behavior. A note in that folder with no recognized \`type\` is *not* a card. A card's
  identity is its \`id\`, never its path, so files rename safely.
- A **type** declares its **states**, its **parent** rule, and the **fields** shown on the
  card face. Nesting is one level (a type may have \`parent: <other-type>\`).
- A **state** is a status a card of that type may hold; each maps to a board **column** (or
  to nothing, meaning "valid status, hidden from the board").
- A **column** is what you see on the board. Several states can map to one column.

**Config drives all of it.** Types, states, columns, and field definitions come from
\`.mos/config.json\` — never invent a value that isn't declared there. \`status\` must be one
of the card type's states. mos hardcodes no \`F-\`/\`T-\` scheme, no fixed columns, no type
names: a vault defines its own vocabulary.

Required card frontmatter: \`id\`, \`type\`, \`title\`, \`status\`. Optional fields
(\`priority\`, \`owner\`, \`parent\`, \`dependsOn\`, \`touches\`, timestamps, …) are typed by
the config's field registry and shown per the type's \`card.fields\`.

## Areas & touches, parallel batches

- **Areas** are vault-defined names for file surfaces, mapped to globs in config's
  \`areas\`. The names are the vocabulary; the globs say what each means here.
- **\`touches\`** is a card field listing the areas the work expects to modify
  (\`touches: [core, docs]\`). Fill it at planning time from the card's own plan, and keep
  it honest when scope changes — a stale declaration silently poisons planning.
- A **parallel batch** is a set of *ready* cards (every dependency done) whose \`touches\`
  are **pairwise disjoint** — unblocked *and* collision-free, so they can run at once. A
  card with no \`touches\` is set aside (surface unknown); an explicit \`touches: []\`
  declares "touches nothing" and batches with anything.

\`dependsOn\` captures logical order; \`touches\` captures physical surface. Both matter:
two unblocked cards can still collide if they edit the same files.

## Write conventions

You are the write path; mos only reads. The rules:

1. **Config is the vocabulary.** Use only types, states, and columns config declares.
2. **Ids are unique and stable** — never reused once assigned; if a card is dropped, leave
   its id reserved.
3. **Edit frontmatter only — never rewrite a card's prose body** once it has left its
   initial state. Move a card by changing \`status\`. The one allowed prose edit is ticking
   a finished card's own \`## Acceptance\` checkboxes on ship. (Reshaping a card still in
   its type's *initial* state — refinement — is the deliberate exception; see your docs.)
4. **Timestamps are yours.** Set \`created\` and \`updated\` on create; bump \`updated\` on
   every frontmatter edit; leave \`created\` alone. Always **ISO 8601 UTC with a \`Z\`
   suffix** (\`2026-06-08T09:00:00Z\`) — never a local time or offset. mos never writes
   them. (Field names are configurable via \`meta.timestamps\`.)
5. **Emit frontmatter in the vault's canonical order** — the config's \`fieldOrder\` when
   present, else the spec's documented default. Order never affects rendering, but the
   validator warns on deviation.

After changing cards, reload the board (\`mos serve\`) or run \`mos validate\` to confirm
every card still lands in a column and references resolve.

## Versioning

mos has three independently versioned axes; keep them distinct:

- **Spec version** — the vault *format* contract (this vault targets **${specVersion}**),
  declared as \`specVersion\` in \`.mos/config.json\`. It is versioned separately from the
  tool because vaults depend on the format. Bumped only when the format itself changes; new
  format features are additive, so a vault on an older spec stays valid.
- **CLI / app version** — the mos tool that reads the vault, versioned on its own track
  (SemVer). The tool **states which spec versions it supports**; a tool reads any vault
  whose \`specVersion\` falls in that supported range. Upgrading the tool does not force a
  vault to change its \`specVersion\`.
- **Skills version** — the agent skills that operate a vault are **self-contained**: they
  gate only on \`.mos/config.json\` and carry their own versions. They may *reference* this
  guide as extra context but never *require* it, so hand-made or older-init vaults that
  lack it still work.

The spec is the floor everything else builds on. When in doubt about the format, the spec
wins; when in doubt about how to operate, this guide wins.

## The formal contract lives in the spec

This guide intentionally does **not** restate exact field lists, validation rules, the glob
dialect, or link-resolution semantics — those are the spec's job (your mos docs'
\`VAULT_SPEC\`, targeting version ${specVersion}). Read it when you need the precise format;
read this guide for how to operate day to day.
`;
}

export interface InitResult {
  vaultDir: string;
  created: string[];
  skipped: string[];
}

export class InitRefusedError extends Error {}

/**
 * Scaffold a vault at `dir`. Refuses (throws InitRefusedError) when the folder
 * already is a vault; skips — never overwrites — anything else that exists.
 */
export function initVault(dir: string, now = new Date()): InitResult {
  const vaultDir = resolve(dir);
  const configPath = join(vaultDir, '.mos', 'config.json');
  if (existsSync(configPath)) {
    throw new InitRefusedError(
      `Already a mos vault: ${configPath} exists. ` +
        'mos init never overwrites or merges — edit the config directly instead.',
    );
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const write = (relPath: string, content: string) => {
    const full = join(vaultDir, relPath);
    if (existsSync(full)) {
      skipped.push(relPath);
      return;
    }
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content, 'utf-8');
    created.push(relPath);
  };

  write('.mos/config.json', starterConfig(basename(vaultDir)));
  write('.mos/AGENTS.md', frameworkGuide(SPEC_VERSION));
  write('board/T-001-explore-the-board.md', exampleCard(isoNow(now)));
  write('AGENTS.md', agentsStub(basename(vaultDir)));

  return { vaultDir, created, skipped };
}
