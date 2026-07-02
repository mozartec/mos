import { describe, expect, it } from 'vitest';
import type { VaultConfig } from './config.js';
import type { Card, VaultModel } from './models.js';
import { buildEdges } from './edges.js';
import {
  childrenOf,
  childrenProgress,
  containerIds,
  dependentsOf,
  isContainer,
} from './relations.js';

const config: VaultConfig = {
  specVersion: '0.3',
  vault: { name: 'test' },
  meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
  fields: {
    dependsOn: { type: 'id', list: true, label: 'Depends on' },
  },
  wiki: { include: [], exclude: [], fields: [] },
  board: {
    include: ['board/**'],
    columns: ['Backlog', 'In Progress', 'Done'],
    sortWithinColumn: [],
  },
  references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
  types: {
    feature: {
      parent: null,
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
    },
    story: {
      parent: 'feature',
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
    },
  },
  sprints: [],
  areas: {},
  fieldOrder: [],
};

interface CardSpec {
  id: string;
  type?: string;
  status?: string;
  parent?: unknown;
  dependsOn?: unknown;
}

function model(cards: CardSpec[]): VaultModel {
  const entries: Record<string, Card> = {};
  for (const c of cards) {
    const fields: Record<string, unknown> = {};
    if (c.parent !== undefined) fields.parent = c.parent;
    if (c.dependsOn !== undefined) fields.dependsOn = c.dependsOn;
    entries[c.id] = {
      id: c.id,
      type: c.type ?? 'story',
      title: c.id,
      status: c.status ?? 'Todo',
      path: `board/${c.id}.md`,
      fields,
    };
  }
  return { cards: entries, files: [] };
}

const ids = (cards: Card[]): string[] => cards.map((c) => c.id);

describe('childrenOf', () => {
  it('returns the cards whose parent is the id, in card-id order', () => {
    const m = model([
      { id: 'F-1', type: 'feature' },
      { id: 'F-1-S-2', parent: 'F-1' },
      { id: 'F-1-S-1', parent: 'F-1' },
      { id: 'F-2', type: 'feature' },
    ]);
    expect(ids(childrenOf(m, 'F-1'))).toEqual(['F-1-S-1', 'F-1-S-2']);
  });

  it('returns an empty list for a card with no children', () => {
    const m = model([
      { id: 'F-2', type: 'feature' },
      { id: 'F-1-S-1', parent: 'F-1' },
    ]);
    expect(childrenOf(m, 'F-2')).toEqual([]);
  });

  it('returns only direct children, not descendants further down the chain', () => {
    // Structural lookup: F-1 → S → T. childrenOf(F-1) is the direct child only.
    const m = model([
      { id: 'F-1', type: 'feature' },
      { id: 'S', parent: 'F-1' },
      { id: 'T', parent: 'S' },
    ]);
    expect(ids(childrenOf(m, 'F-1'))).toEqual(['S']);
    expect(ids(childrenOf(m, 'S'))).toEqual(['T']);
  });

  it('skips an unresolved or non-string parent without crashing', () => {
    const m = model([
      { id: 'F-1', type: 'feature' },
      { id: 'ok', parent: 'F-1' },
      { id: 'orphan', parent: 'GHOST' }, // points at a card that does not exist
      { id: 'malformed', parent: 42 }, // not a string
    ]);
    expect(ids(childrenOf(m, 'F-1'))).toEqual(['ok']);
    expect(childrenOf(m, 'GHOST')).toHaveLength(1); // the dangling ref still resolves structurally
    expect(childrenOf(m, '42')).toEqual([]); // a numeric parent never matches a string id
  });
});

describe('dependentsOf', () => {
  it('returns the cards that depend on the id, reusing the edge set', () => {
    const m = model([
      { id: 'T-001' },
      { id: 'T-002', dependsOn: ['T-001'] },
      { id: 'T-003', dependsOn: ['T-001'] },
    ]);
    const { edges, errors } = buildEdges(m, config);
    expect(errors).toEqual([]);
    expect(ids(dependentsOf(m, edges, 'T-001'))).toEqual(['T-002', 'T-003']);
  });

  it('does not double-count a dependent that lists the same id twice', () => {
    const m = model([{ id: 'T-001' }, { id: 'T-002', dependsOn: ['T-001', 'T-001'] }]);
    const { edges } = buildEdges(m, config);
    expect(ids(dependentsOf(m, edges, 'T-001'))).toEqual(['T-002']);
  });

  it('returns an empty list for a card with no incoming edges', () => {
    const m = model([{ id: 'T-001' }, { id: 'T-002', dependsOn: ['T-001'] }]);
    const { edges } = buildEdges(m, config);
    expect(dependentsOf(m, edges, 'T-002')).toEqual([]);
  });

  it('skips an edge whose source no longer resolves to a card, without crashing', () => {
    const m = model([{ id: 'T-001' }]);
    // A hand-built edge set whose `from` was dropped from the model.
    const edges = [{ from: 'T-404', to: 'T-001' }];
    expect(dependentsOf(m, edges, 'T-001')).toEqual([]);
  });
});

describe('containerIds / isContainer', () => {
  it('classifies a card as a container when other cards name it as parent', () => {
    const m = model([
      { id: 'F-1', type: 'feature' },
      { id: 'F-1-S-1', parent: 'F-1' },
      { id: 'F-2', type: 'feature' },
    ]);
    expect(containerIds(m)).toEqual(new Set(['F-1']));
    expect(isContainer(m, 'F-1')).toBe(true);
    expect(isContainer(m, 'F-2')).toBe(false);
    expect(isContainer(m, 'F-1-S-1')).toBe(false);
  });

  it('classifies every level of a multi-level chain: a container whose parent is also a container', () => {
    // F-1 → S (both child and container) → T (leaf): only T stays a leaf.
    const m = model([
      { id: 'F-1', type: 'feature' },
      { id: 'S', parent: 'F-1' },
      { id: 'T', parent: 'S' },
    ]);
    expect(containerIds(m)).toEqual(new Set(['F-1', 'S']));
    expect(isContainer(m, 'S')).toBe(true);
    expect(isContainer(m, 'T')).toBe(false);
  });

  it('classifies from data, never from the type name', () => {
    // A story parenting another story is a container; a childless feature is not.
    const m = model([{ id: 'F-1', type: 'feature' }, { id: 'S-1' }, { id: 'S-2', parent: 'S-1' }]);
    expect(isContainer(m, 'S-1')).toBe(true);
    expect(isContainer(m, 'F-1')).toBe(false);
  });

  it('skips non-string parents and keeps a dangling parent id, without crashing', () => {
    const m = model([
      { id: 'F-1', type: 'feature' },
      { id: 'ok', parent: 'F-1' },
      { id: 'orphan', parent: 'GHOST' }, // stray parent: reported by the validator, harmless here
      { id: 'malformed', parent: 42 },
      { id: 'empty', parent: '' },
    ]);
    // GHOST is in the set (structural, like childrenOf) — but it never matches a
    // real card's id, so no card is misclassified by it.
    expect(containerIds(m)).toEqual(new Set(['F-1', 'GHOST']));
    expect(isContainer(m, '42')).toBe(false);
  });

  it('returns an empty set for a flat vault (no parent fields at all)', () => {
    const m = model([{ id: 'R-1', type: 'feature' }, { id: 'R-2' }]);
    expect(containerIds(m)).toEqual(new Set());
  });
});

describe('childrenProgress', () => {
  it('rolls up n done / m total via the last column, not a hardcoded state', () => {
    const m = model([
      { id: 'F-1', type: 'feature' },
      { id: 'F-1-S-1', parent: 'F-1', status: 'Done' },
      { id: 'F-1-S-2', parent: 'F-1', status: 'In Progress' },
      { id: 'F-1-S-3', parent: 'F-1', status: 'Todo' },
    ]);
    expect(childrenProgress(m, config, 'F-1')).toEqual({ done: 1, total: 3 });
  });

  it("derives done from the config's last column under any vocabulary", () => {
    // A recipe-box-style vault: the last column is 'Plated', the done state 'Served'.
    const recipeConfig: VaultConfig = {
      ...config,
      board: { include: ['board/**'], columns: ['Prep', 'Plated'], sortWithinColumn: [] },
      types: {
        menu: { parent: null, states: { Draft: 'Prep', Served: 'Plated' } },
        dish: { parent: 'menu', states: { Draft: 'Prep', Served: 'Plated' } },
      },
    };
    const m = model([
      { id: 'M-1', type: 'menu' },
      { id: 'M-1-D-1', type: 'dish', parent: 'M-1', status: 'Served' },
      { id: 'M-1-D-2', type: 'dish', parent: 'M-1', status: 'Draft' },
    ]);
    expect(childrenProgress(m, recipeConfig, 'M-1')).toEqual({ done: 1, total: 2 });
  });

  it('reports 0/0 for a card with no children', () => {
    const m = model([{ id: 'F-1', type: 'feature' }]);
    expect(childrenProgress(m, config, 'F-1')).toEqual({ done: 0, total: 0 });
  });

  it('rolls up direct children only in a multi-level tree — grandchildren never double-count', () => {
    // F → S (a done container child) → T-1/T-2 (one done, one not).
    const m = model([
      { id: 'F', type: 'feature' },
      { id: 'S', parent: 'F', status: 'Done' },
      { id: 'T-1', parent: 'S', status: 'Done' },
      { id: 'T-2', parent: 'S', status: 'Todo' },
    ]);
    // F counts S by S's own status; T-1/T-2 belong to S's rollup, not F's.
    expect(childrenProgress(m, config, 'F')).toEqual({ done: 1, total: 1 });
    expect(childrenProgress(m, config, 'S')).toEqual({ done: 1, total: 2 });
  });
});
