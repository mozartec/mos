/**
 * `mos init` — turn a folder into a valid mos vault (F-016, ADR-013).
 *
 * Scaffolding, not runtime writes: this runs once to create a vault where none
 * exists. It refuses to touch an existing vault — no overwrite, no merge
 * (ADR-013) — and the serving app stays read-only (ADR-002).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/** ISO 8601 UTC without milliseconds — the vault timestamp convention. */
function isoNow(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function starterConfig(vaultName: string): string {
  const config = {
    specVersion: '0.4',
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
  write('board/T-001-explore-the-board.md', exampleCard(isoNow(now)));
  write('AGENTS.md', agentsStub(basename(vaultDir)));

  return { vaultDir, created, skipped };
}
