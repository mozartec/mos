import { describe, expect, it } from 'vitest';
import type { VaultConfig } from './config.js';
import type { Card, VaultModel } from './models.js';
import { parallelBatch, resolveTouches } from './parallel.js';

function makeConfig(areas: Record<string, string[]> = {}): VaultConfig {
  return {
    specVersion: '0.4',
    vault: { name: 'test' },
    meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
    fields: {
      priority: { type: 'enum', values: ['P0', 'P1', 'P2', 'P3'] },
      dependsOn: { type: 'id', list: true },
      touches: { type: 'enum', source: 'areas', list: true },
    },
    wiki: { include: [], exclude: [], fields: [] },
    board: { include: ['board/**'], columns: ['Backlog', 'Done'], sortWithinColumn: [] },
    references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
    types: {
      task: { parent: null, states: { Todo: 'Backlog', Done: 'Done' } },
    },
    sprints: [],
    areas,
    fieldOrder: [],
  };
}

const AREAS = {
  core: ['packages/core/**'],
  web: ['apps/web/**'],
  docs: ['docs/**', '*.md'],
};

function model(
  cards: Array<{
    id: string;
    touches?: string[];
    dependsOn?: string[];
    priority?: string;
    status?: string;
  }>,
): VaultModel {
  const entries: Record<string, Card> = {};
  for (const c of cards) {
    const fields: Record<string, unknown> = {};
    if (c.touches !== undefined) fields['touches'] = c.touches;
    if (c.dependsOn !== undefined) fields['dependsOn'] = c.dependsOn;
    entries[c.id] = {
      id: c.id,
      type: 'task',
      title: `Title ${c.id}`,
      status: c.status ?? 'Todo',
      path: `board/${c.id}.md`,
      priority: c.priority,
      fields,
    };
  }
  return { cards: entries, files: [] };
}

describe('resolveTouches', () => {
  it('splits declared names into configured areas and unknown names', () => {
    const m = model([{ id: 'T-001', touches: ['core', 'webz', 'docs'] }]);
    const resolved = resolveTouches(m.cards['T-001'], makeConfig(AREAS));
    expect(resolved.areas).toEqual(['core', 'docs']);
    expect(resolved.unknown).toEqual(['webz']);
  });

  it('collects the globs of the resolved areas, deduped, in area order', () => {
    const m = model([{ id: 'T-001', touches: ['docs', 'core'] }]);
    const resolved = resolveTouches(m.cards['T-001'], makeConfig(AREAS));
    expect(resolved.globs).toEqual(['docs/**', '*.md', 'packages/core/**']);
  });

  it('resolves a missing or empty declaration to all-empty', () => {
    const m = model([{ id: 'T-001' }, { id: 'T-002', touches: [] }]);
    for (const id of ['T-001', 'T-002']) {
      const resolved = resolveTouches(m.cards[id], makeConfig(AREAS));
      expect(resolved).toEqual({ areas: [], globs: [], unknown: [] });
    }
  });
});

describe('parallelBatch', () => {
  it('batches ready cards whose touches are pairwise disjoint', () => {
    const result = parallelBatch(
      model([
        { id: 'T-001', touches: ['core'] },
        { id: 'T-002', touches: ['web'] },
        { id: 'T-003', touches: ['docs'] },
      ]),
      makeConfig(AREAS),
    );
    expect(result.batch).toEqual(['T-001', 'T-002', 'T-003']);
    expect(result.conflicts).toEqual([]);
    expect(result.undeclared).toEqual([]);
  });

  it('excludes an overlapping card and reports the conflicting pair', () => {
    const result = parallelBatch(
      model([
        { id: 'T-001', touches: ['core', 'docs'] },
        { id: 'T-002', touches: ['web'] },
        { id: 'T-003', touches: ['docs', 'web'] },
      ]),
      makeConfig(AREAS),
    );
    expect(result.batch).toEqual(['T-001', 'T-002']);
    expect(result.conflicts).toEqual([
      { excluded: 'T-003', with: 'T-001', areas: ['docs'] },
      { excluded: 'T-003', with: 'T-002', areas: ['web'] },
    ]);
  });

  it('prefers higher-priority cards when surfaces collide', () => {
    const result = parallelBatch(
      model([
        { id: 'T-001', touches: ['core'], priority: 'P2' },
        { id: 'T-002', touches: ['core'], priority: 'P0' },
      ]),
      makeConfig(AREAS),
    );
    expect(result.batch).toEqual(['T-002']);
    expect(result.conflicts).toEqual([{ excluded: 'T-001', with: 'T-002', areas: ['core'] }]);
  });

  it('sets aside ready cards with no touches declaration as undeclared', () => {
    const result = parallelBatch(
      model([{ id: 'T-001', touches: ['core'] }, { id: 'T-002' }]),
      makeConfig(AREAS),
    );
    expect(result.batch).toEqual(['T-001']);
    expect(result.undeclared).toEqual(['T-002']);
    expect(result.conflicts).toEqual([]);
  });

  it('batches a declared-empty surface: an explicit [] touches nothing', () => {
    const result = parallelBatch(
      model([
        { id: 'T-001', touches: ['core'] },
        { id: 'T-002', touches: [] },
      ]),
      makeConfig(AREAS),
    );
    expect(result.batch).toEqual(['T-001', 'T-002']);
  });

  it('leaves cards with unfinished dependencies out entirely', () => {
    const result = parallelBatch(
      model([
        { id: 'T-001', touches: ['core'] },
        { id: 'T-002', touches: ['web'], dependsOn: ['T-001'] },
        { id: 'T-003', touches: ['docs'], dependsOn: ['T-004'] },
        { id: 'T-004', touches: [], status: 'Done' },
      ]),
      makeConfig(AREAS),
    );
    // T-002 waits on unfinished T-001; T-003's dependency is done, so it is ready.
    expect(result.batch).toEqual(['T-001', 'T-003']);
    expect(result.conflicts).toEqual([]);
    expect(result.undeclared).toEqual([]);
  });

  it('treats unknown area names as colliding by name', () => {
    const result = parallelBatch(
      model([
        { id: 'T-001', touches: ['webz'] },
        { id: 'T-002', touches: ['webz'] },
      ]),
      makeConfig(AREAS),
    );
    expect(result.batch).toEqual(['T-001']);
    expect(result.conflicts).toEqual([{ excluded: 'T-002', with: 'T-001', areas: ['webz'] }]);
  });

  it('degrades to the plain ready set when the vault configures no areas', () => {
    const result = parallelBatch(
      model([
        { id: 'T-001' },
        { id: 'T-002', touches: ['core'] },
        { id: 'T-003', touches: ['core'] },
        { id: 'T-004', dependsOn: ['T-001'] },
      ]),
      makeConfig(),
    );
    expect(result.batch).toEqual(['T-001', 'T-002', 'T-003']);
    expect(result.conflicts).toEqual([]);
    expect(result.undeclared).toEqual([]);
  });
});
