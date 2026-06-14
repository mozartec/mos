import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadConfig, type VaultConfig } from './config.js';
import { parseFile } from './parse-file.js';
import { buildModel, type Card, type VaultModel } from './models.js';
import { buildDependencyGraph, criticalPath, readySet } from './graph.js';

const config: VaultConfig = {
  specVersion: '0.3',
  vault: { name: 'test' },
  meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
  fields: {
    priority: { type: 'enum', values: ['P0', 'P1', 'P2', 'P3'] },
    dependsOn: { type: 'id', list: true },
  },
  wiki: { include: [], exclude: [], fields: [] },
  board: { include: ['board/**'], columns: ['Backlog', 'Done'], sortWithinColumn: [] },
  references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
  types: {
    task: { parent: null, states: { Todo: 'Backlog', Done: 'Done' } },
  },
  sprints: [],
  areas: {},
  fieldOrder: [],
};

function model(
  cards: Array<{ id: string; dependsOn?: string[]; priority?: string; status?: string }>,
): VaultModel {
  const entries: Record<string, Card> = {};
  for (const c of cards) {
    entries[c.id] = {
      id: c.id,
      type: 'task',
      title: `Title ${c.id}`,
      status: c.status ?? 'Todo',
      path: `board/${c.id}.md`,
      priority: c.priority,
      fields: c.dependsOn === undefined ? {} : { dependsOn: c.dependsOn },
    };
  }
  return { cards: entries, files: [] };
}

function ranksOf(graph: ReturnType<typeof buildDependencyGraph>): Record<string, number> {
  return Object.fromEntries(graph.nodes.map((n) => [n.id, n.rank]));
}

describe('buildDependencyGraph', () => {
  it('ranks a linear chain by longest path from the root', () => {
    const graph = buildDependencyGraph(
      model([
        { id: 'T-001' },
        { id: 'T-002', dependsOn: ['T-001'] },
        { id: 'T-003', dependsOn: ['T-002'] },
      ]),
      config,
    );
    expect(graph.errors).toEqual([]);
    expect(ranksOf(graph)).toEqual({ 'T-001': 0, 'T-002': 1, 'T-003': 2 });
  });

  it('handles a diamond: fan-out, fan-in, longest path wins', () => {
    const graph = buildDependencyGraph(
      model([
        { id: 'T-001' },
        { id: 'T-002', dependsOn: ['T-001'] },
        { id: 'T-003', dependsOn: ['T-001', 'T-002'] },
        { id: 'T-004', dependsOn: ['T-002', 'T-003'] },
      ]),
      config,
    );
    // T-003 depends on T-002 (rank 1) so it is rank 2; T-004 then rank 3.
    expect(ranksOf(graph)).toEqual({ 'T-001': 0, 'T-002': 1, 'T-003': 2, 'T-004': 3 });
  });

  it('a dependent always outranks each of its prerequisites', () => {
    const graph = buildDependencyGraph(
      model([{ id: 'T-001' }, { id: 'T-002' }, { id: 'T-003', dependsOn: ['T-001', 'T-002'] }]),
      config,
    );
    const ranks = ranksOf(graph);
    for (const edge of graph.edges) {
      expect(ranks[edge.from]).toBeGreaterThan(ranks[edge.to]);
    }
  });

  it('includes a disconnected node at rank 0', () => {
    const graph = buildDependencyGraph(
      model([{ id: 'T-001' }, { id: 'T-002', dependsOn: ['T-001'] }, { id: 'T-099' }]),
      config,
    );
    expect(ranksOf(graph)['T-099']).toBe(0);
  });

  it('orders within a rank by priority then id, deterministically', () => {
    const graph = buildDependencyGraph(
      model([
        { id: 'T-003', priority: 'P0' },
        { id: 'T-001', priority: 'P1' },
        { id: 'T-002', priority: 'P0' },
      ]),
      config,
    );
    const rankZero = graph.nodes.filter((n) => n.rank === 0).map((n) => n.id);
    expect(rankZero).toEqual(['T-002', 'T-003', 'T-001']);
    expect(graph.nodes.map((n) => n.order)).toEqual([0, 1, 2]);
  });

  it('breaks a cycle instead of looping: flagged edge, finite ranks', () => {
    const graph = buildDependencyGraph(
      model([
        { id: 'T-001', dependsOn: ['T-003'] },
        { id: 'T-002', dependsOn: ['T-001'] },
        { id: 'T-003', dependsOn: ['T-002'] },
      ]),
      config,
    );
    expect(graph.errors.some((e) => e.startsWith('dependency cycle:'))).toBe(true);
    expect(graph.edges.filter((e) => e.broken)).toHaveLength(1);
    // Every node still got a finite rank.
    expect(graph.nodes).toHaveLength(3);
    for (const node of graph.nodes) expect(Number.isFinite(node.rank)).toBe(true);
  });

  it('is deterministic: same input, same layout', () => {
    const make = () =>
      buildDependencyGraph(
        model([
          { id: 'T-002', dependsOn: ['T-001'] },
          { id: 'T-001' },
          { id: 'T-003', dependsOn: ['T-001'] },
        ]),
        config,
      );
    expect(make()).toEqual(make());
  });

  it('carries status and title onto nodes for rendering', () => {
    const graph = buildDependencyGraph(model([{ id: 'T-001', status: 'Done' }]), config);
    expect(graph.nodes[0]).toMatchObject({ id: 'T-001', status: 'Done', title: 'Title T-001' });
  });
});

// ── This repository's own vault as the acceptance fixture (F-012-S-03) ──────

const WALK_IGNORE = new Set([
  'node_modules',
  '.git',
  '.angular',
  '.turbo',
  'dist',
  '.cache',
  'examples',
]);

function walkMarkdown(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (WALK_IGNORE.has(name)) continue;
    const absPath = join(dir, name);
    let st;
    try {
      st = statSync(absPath);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkMarkdown(absPath, files);
    else if (absPath.endsWith('.md')) files.push(absPath);
  }
  return files;
}

describe('buildDependencyGraph on this repository vault', () => {
  it('reproduces the real dependency structure: edges resolve, no cycles', () => {
    const vaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const { config: repoConfig } = loadConfig(
      readFileSync(join(vaultRoot, '.mos', 'config.json'), 'utf8'),
    );
    const parsed = walkMarkdown(vaultRoot).map((absPath) =>
      parseFile(relative(vaultRoot, absPath).replaceAll('\\', '/'), readFileSync(absPath, 'utf8')),
    );
    const graph = buildDependencyGraph(buildModel(parsed, repoConfig).model, repoConfig);

    expect(graph.errors).toEqual([]);
    expect(graph.edges.length).toBeGreaterThan(20);
    const ranks = Object.fromEntries(graph.nodes.map((n) => [n.id, n.rank]));
    for (const edge of graph.edges) {
      expect(ranks[edge.from]).toBeGreaterThan(ranks[edge.to]);
    }
  });
});

describe('readySet', () => {
  it('returns exactly the cards whose dependencies are all done and are not done', () => {
    const graph = buildDependencyGraph(
      model([
        { id: 'T-001', status: 'Done' },
        { id: 'T-002', dependsOn: ['T-001'] }, // ready: dep done
        { id: 'T-003', dependsOn: ['T-002'] }, // waiting on T-002
        { id: 'T-004' }, // ready: no deps
        { id: 'T-005', status: 'Done' }, // done already, never "ready"
      ]),
      config,
    );
    expect(readySet(graph)).toEqual(['T-002', 'T-004']);
  });

  it('updates when a node flips to done', () => {
    const before = buildDependencyGraph(
      model([{ id: 'T-001' }, { id: 'T-002', dependsOn: ['T-001'] }]),
      config,
    );
    expect(readySet(before)).toEqual(['T-001']);
    const after = buildDependencyGraph(
      model([
        { id: 'T-001', status: 'Done' },
        { id: 'T-002', dependsOn: ['T-001'] },
      ]),
      config,
    );
    expect(readySet(after)).toEqual(['T-002']);
  });
});

describe('criticalPath', () => {
  it('returns the longest prerequisite chain in a diamond', () => {
    const graph = buildDependencyGraph(
      model([
        { id: 'T-001' },
        { id: 'T-002', dependsOn: ['T-001'] },
        { id: 'T-003', dependsOn: ['T-001', 'T-002'] },
        { id: 'T-004', dependsOn: ['T-002', 'T-003'] },
      ]),
      config,
    );
    expect(criticalPath(graph)).toEqual(['T-001', 'T-002', 'T-003', 'T-004']);
  });

  it('returns a single node for an edgeless graph and [] for an empty one', () => {
    expect(criticalPath(buildDependencyGraph(model([{ id: 'T-001' }]), config))).toEqual(['T-001']);
    expect(criticalPath(buildDependencyGraph(model([]), config))).toEqual([]);
  });

  it('ignores cycle-broken edges instead of looping', () => {
    const graph = buildDependencyGraph(
      model([
        { id: 'T-001', dependsOn: ['T-002'] },
        { id: 'T-002', dependsOn: ['T-001'] },
        { id: 'T-003', dependsOn: ['T-002'] },
      ]),
      config,
    );
    // T-002 → T-001 was broken; both surviving chains have length 2 and the
    // tie breaks deterministically toward the smallest end id.
    expect(criticalPath(graph)).toEqual(['T-002', 'T-001']);
  });
});
