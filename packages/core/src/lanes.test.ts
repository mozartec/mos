import { describe, expect, it } from 'vitest';
import type { VaultConfig } from './config.js';
import type { Card, VaultModel } from './models.js';
import { groupIntoLanes, laneField, UNASSIGNED_LANE_KEY } from './lanes.js';

/** Base config: a 3-column board, priority/owner fields, feature > story types. */
const base: VaultConfig = {
  specVersion: '0.4',
  vault: { name: 'test' },
  meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
  fields: {
    priority: { type: 'enum', values: ['P0', 'P1', 'P2', 'P3'], label: 'Priority' },
    owner: { type: 'string', label: 'Owner' },
  },
  wiki: { include: [], exclude: [], fields: [] },
  board: {
    include: ['board/**'],
    columns: ['Backlog', 'In Progress', 'Done'],
    sortWithinColumn: ['priority', 'id'],
  },
  references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
  types: {
    feature: {
      parent: null,
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done', Deferred: null },
    },
    story: {
      parent: 'feature',
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done', Deferred: null },
    },
  },
  sprints: [],
  areas: {},
  fieldOrder: [],
};

/** Config variants: same board, different lane grouping. */
const flat = base;
const byParent: VaultConfig = { ...base, board: { ...base.board, laneField: 'parent' } };
const byOwner: VaultConfig = { ...base, board: { ...base.board, laneField: 'owner' } };

interface CardSpec {
  id: string;
  type?: string;
  status?: string;
  parent?: string;
  priority?: string;
  owner?: string;
  title?: string;
}

function model(cards: CardSpec[]): VaultModel {
  const entries: Record<string, Card> = {};
  for (const c of cards) {
    const fields: Record<string, unknown> = {};
    if (c.parent !== undefined) fields.parent = c.parent;
    if (c.priority !== undefined) fields.priority = c.priority;
    if (c.owner !== undefined) fields.owner = c.owner;
    entries[c.id] = {
      id: c.id,
      type: c.type ?? 'story',
      title: c.title ?? c.id,
      status: c.status ?? 'Todo',
      path: `board/${c.id}.md`,
      fields,
      ...(c.priority !== undefined ? { priority: c.priority } : {}),
    } as Card;
  }
  return { cards: entries, files: [] };
}

/** All cards in a model, the way the board hands its narrowed set to grouping. */
const all = (m: VaultModel): Card[] => Object.values(m.cards);

/** A lane's column → the ids in it, for compact assertions. */
const colIds = (lane: { columns: { name: string; cards: Card[] }[] }, name: string): string[] =>
  lane.columns.find((c) => c.name === name)?.cards.map((c) => c.id) ?? [];

describe('laneField', () => {
  it('is null when unset (flat board) and the configured value otherwise', () => {
    expect(laneField(flat)).toBeNull();
    expect(laneField(byParent)).toBe('parent');
    expect(laneField(byOwner)).toBe('owner');
  });
});

describe('groupIntoLanes — flat (no laneField)', () => {
  it('returns one unnamed, headerless lane holding every placed leaf', () => {
    const m = model([
      { id: 'S-2', status: 'Todo', priority: 'P1' },
      { id: 'S-1', status: 'Todo', priority: 'P0' },
      { id: 'S-3', status: 'In Progress' },
    ]);
    const { lanes, errors } = groupIntoLanes(m, flat, all(m));
    expect(errors).toEqual([]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].header).toBeNull();
    expect(lanes[0].isUnassigned).toBe(false);
    // Placed and sorted exactly as the flat board: P0 before P1 in Backlog.
    expect(colIds(lanes[0], 'Backlog')).toEqual(['S-1', 'S-2']);
    expect(colIds(lanes[0], 'In Progress')).toEqual(['S-3']);
  });

  it('keeps hidden-state (Deferred) cards off every column', () => {
    const m = model([{ id: 'S-1', status: 'Deferred' }]);
    const { lanes } = groupIntoLanes(m, flat, all(m));
    expect(lanes[0].columns.flatMap((c) => c.cards)).toEqual([]);
  });

  it('surfaces a placement error for an unplaceable card', () => {
    const m = model([{ id: 'S-BAD', status: 'UNKNOWN' }]);
    const { errors } = groupIntoLanes(m, flat, all(m));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('S-BAD');
  });
});

describe('groupIntoLanes — parent lanes', () => {
  it('makes one lane per container, ordered by the container rank, with a progress header', () => {
    const m = model([
      { id: 'F-1', type: 'feature', status: 'In Progress', priority: 'P1', title: 'Feature one' },
      { id: 'F-2', type: 'feature', status: 'Todo', priority: 'P0', title: 'Feature two' },
      { id: 'F-1-S-1', parent: 'F-1', status: 'Done' },
      { id: 'F-1-S-2', parent: 'F-1', status: 'Todo' },
      { id: 'F-2-S-1', parent: 'F-2', status: 'In Progress' },
    ]);
    const { lanes } = groupIntoLanes(m, byParent, all(m));
    // F-2 (P0) before F-1 (P1) — lane order uses the same rank as a column.
    expect(lanes.map((l) => l.key)).toEqual(['F-2', 'F-1']);

    const f1 = lanes.find((l) => l.key === 'F-1')!;
    expect(f1.header?.id).toBe('F-1');
    expect(f1.label).toBe('Feature one');
    expect(f1.progress).toEqual({ done: 1, total: 2 });
    expect(colIds(f1, 'Done')).toEqual(['F-1-S-1']);
    expect(colIds(f1, 'Backlog')).toEqual(['F-1-S-2']);
  });

  it('never places a container in a column cell — it is a header only (ADR-019)', () => {
    const m = model([
      { id: 'F-1', type: 'feature', status: 'In Progress', title: 'Feature one' },
      { id: 'F-1-S-1', parent: 'F-1', status: 'Todo' },
    ]);
    const { lanes } = groupIntoLanes(m, byParent, all(m));
    const everyCell = lanes.flatMap((l) =>
      l.columns.flatMap((c) => c.cards.map((card) => card.id)),
    );
    expect(everyCell).not.toContain('F-1'); // the container is the header, not a cell
    expect(everyCell).toEqual(['F-1-S-1']);
  });

  it('collects leaves with no or dangling parent into a trailing unassigned lane', () => {
    const m = model([
      { id: 'F-1', type: 'feature', status: 'Todo', title: 'Feature one' },
      { id: 'F-1-S-1', parent: 'F-1', status: 'Todo' },
      { id: 'LOOSE', status: 'Todo' }, // no parent
      { id: 'GHOSTKID', parent: 'MISSING', status: 'Todo' }, // dangling parent
    ]);
    const { lanes } = groupIntoLanes(m, byParent, all(m));
    const last = lanes[lanes.length - 1];
    expect(last.key).toBe(UNASSIGNED_LANE_KEY);
    expect(last.isUnassigned).toBe(true);
    expect(last.header).toBeNull();
    expect(colIds(last, 'Backlog')).toEqual(['GHOSTKID', 'LOOSE']);
  });

  it('rolls up progress over the whole model, even children hidden by the current filter', () => {
    const m = model([
      { id: 'F-1', type: 'feature', status: 'Todo', title: 'Feature one' },
      { id: 'F-1-S-1', parent: 'F-1', status: 'Done' },
      { id: 'F-1-S-2', parent: 'F-1', status: 'Done' },
      { id: 'F-1-S-3', parent: 'F-1', status: 'Todo' },
    ]);
    // The board narrowed the visible set to just one child, but progress reflects
    // the container's true subtree (2 of 3 done), not what survived the filter.
    const visible = [m.cards['F-1'], m.cards['F-1-S-3']];
    const { lanes } = groupIntoLanes(m, byParent, visible);
    const f1 = lanes.find((l) => l.key === 'F-1')!;
    expect(f1.progress).toEqual({ done: 2, total: 3 });
    expect(colIds(f1, 'Backlog')).toEqual(['F-1-S-3']);
  });

  it('still reports a placement error for a container with an unknown status', () => {
    const m = model([
      { id: 'F-1', type: 'feature', status: 'UNKNOWN', title: 'Feature one' },
      { id: 'F-1-S-1', parent: 'F-1', status: 'Todo' },
    ]);
    const { errors } = groupIntoLanes(m, byParent, all(m));
    expect(errors.some((e) => e.includes('F-1'))).toBe(true);
  });
});

describe('groupIntoLanes — field lanes', () => {
  it('groups leaves by a field value, ordered by value, with an unassigned lane last', () => {
    const m = model([
      { id: 'S-1', status: 'Todo', owner: 'bob' },
      { id: 'S-2', status: 'Todo', owner: 'alice' },
      { id: 'S-3', status: 'Todo' }, // no owner
    ]);
    const { lanes } = groupIntoLanes(m, byOwner, all(m));
    expect(lanes.map((l) => l.key)).toEqual(['alice', 'bob', UNASSIGNED_LANE_KEY]);
    expect(lanes[0].header).toBeNull();
    expect(colIds(lanes[0], 'Backlog')).toEqual(['S-2']);
    expect(lanes[lanes.length - 1].isUnassigned).toBe(true);
  });
});
