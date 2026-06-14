import { describe, expect, it } from 'vitest';
import type { VaultConfig } from './config.js';
import type { Card, VaultModel } from './models.js';
import { buildDependencyGraph } from './graph.js';
import {
  inFlightAreas,
  inFlightCollisions,
  parallelBatch,
  resolveTouches,
  safeToStart,
} from './parallel.js';

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

/**
 * A three-column board (Backlog · In Progress · Done) so there is a distinct
 * in-flight column for the collision / safe-to-start selectors; {@link makeConfig}'s
 * two-column board has none.
 */
function makeFlightConfig(areas: Record<string, string[]> = {}): VaultConfig {
  return {
    ...makeConfig(areas),
    board: {
      include: ['board/**'],
      columns: ['Backlog', 'In Progress', 'Done'],
      sortWithinColumn: [],
    },
    types: {
      task: {
        parent: null,
        states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
      },
    },
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
      expect(resolved).toEqual({ areas: [], globs: [], unknown: [], malformed: [] });
    }
  });

  it('reports non-string entries as malformed instead of dropping them', () => {
    const m = model([{ id: 'T-001' }]);
    m.cards['T-001'].fields['touches'] = ['core', 3, null];
    const resolved = resolveTouches(m.cards['T-001'], makeConfig(AREAS));
    expect(resolved.areas).toEqual(['core']);
    expect(resolved.malformed).toEqual([3, null]);
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

  it('sets aside a card with a malformed touches entry and reports it', () => {
    const m = model([{ id: 'T-001', touches: ['core'] }, { id: 'T-002' }]);
    m.cards['T-002'].fields['touches'] = [3];
    const result = parallelBatch(m, makeConfig(AREAS));
    // A declaration we can't fully read is an unknown surface, not "touches nothing".
    expect(result.batch).toEqual(['T-001']);
    expect(result.undeclared).toEqual(['T-002']);
    expect(result.errors).toContain('T-002: touches entry is not an area name (3)');
  });

  it('honors a caller-provided dependency graph instead of rebuilding one', () => {
    const m = model([
      { id: 'T-001', touches: ['core'] },
      { id: 'T-002', touches: ['web'], dependsOn: ['T-001'] },
    ]);
    const config = makeConfig(AREAS);
    // A graph built from a state where T-001 is already Done: in it, T-002 is
    // ready and T-001 is not — the opposite of what rebuilding from `m` gives.
    const doneModel = model([
      { id: 'T-001', touches: ['core'], status: 'Done' },
      { id: 'T-002', touches: ['web'], dependsOn: ['T-001'] },
    ]);
    const providedGraph = buildDependencyGraph(doneModel, config);
    expect(parallelBatch(m, config).batch).toEqual(['T-001']);
    expect(parallelBatch(m, config, undefined, providedGraph).batch).toEqual(['T-002']);
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

describe('inFlightCollisions', () => {
  it('pairs in-flight cards that share an area, naming the overlap both ways', () => {
    const result = inFlightCollisions(
      model([
        { id: 'T-001', touches: ['core', 'docs'], status: 'In Progress' },
        { id: 'T-002', touches: ['docs'], status: 'In Progress' },
        { id: 'T-003', touches: ['web'], status: 'In Progress' }, // disjoint
      ]),
      makeFlightConfig(AREAS),
    );
    expect(result).toEqual({
      'T-001': [{ with: 'T-002', areas: ['docs'] }],
      'T-002': [{ with: 'T-001', areas: ['docs'] }],
    });
  });

  it('counts only cards in the in-flight column, not the ones still queued', () => {
    const result = inFlightCollisions(
      model([
        { id: 'T-001', touches: ['core'], status: 'In Progress' },
        { id: 'T-002', touches: ['core'], status: 'Todo' }, // queued, not in flight
        { id: 'T-003', touches: ['core'], status: 'Done' }, // finished
      ]),
      makeFlightConfig(AREAS),
    );
    expect(result).toEqual({});
  });

  it('treats unknown area names as colliding by name, like parallelBatch', () => {
    const result = inFlightCollisions(
      model([
        { id: 'T-001', touches: ['webz'], status: 'In Progress' },
        { id: 'T-002', touches: ['webz'], status: 'In Progress' },
      ]),
      makeFlightConfig(AREAS),
    );
    expect(result).toEqual({
      'T-001': [{ with: 'T-002', areas: ['webz'] }],
      'T-002': [{ with: 'T-001', areas: ['webz'] }],
    });
  });

  it('reports nothing when the vault configures no areas (zero-config silence)', () => {
    const result = inFlightCollisions(
      model([
        { id: 'T-001', touches: ['core'], status: 'In Progress' },
        { id: 'T-002', touches: ['core'], status: 'In Progress' },
      ]),
      makeFlightConfig(),
    );
    expect(result).toEqual({});
  });

  it('reports nothing when the board has no in-flight column (fewer than 3 columns)', () => {
    const result = inFlightCollisions(
      model([
        { id: 'T-001', touches: ['core'] },
        { id: 'T-002', touches: ['core'] },
      ]),
      makeConfig(AREAS), // two-column board: Backlog · Done
    );
    expect(result).toEqual({});
  });
});

describe('inFlightAreas', () => {
  it('unions the declared surfaces of in-flight cards, deduped and sorted', () => {
    const result = inFlightAreas(
      model([
        { id: 'T-001', touches: ['web', 'core'], status: 'In Progress' },
        { id: 'T-002', touches: ['core'], status: 'In Progress' },
        { id: 'T-003', touches: ['docs'], status: 'Todo' }, // not in flight
        { id: 'T-004', touches: ['docs'], status: 'Done' }, // finished
      ]),
      makeFlightConfig(AREAS),
    );
    expect(result).toEqual(['core', 'web']);
  });

  it('is empty without areas or without an in-flight column', () => {
    const cards = model([{ id: 'T-001', touches: ['core'], status: 'In Progress' }]);
    expect(inFlightAreas(cards, makeFlightConfig())).toEqual([]); // no areas
    expect(inFlightAreas(model([{ id: 'T-001', touches: ['core'] }]), makeConfig(AREAS))).toEqual(
      [], // two-column board: no in-flight column
    );
  });
});

describe('safeToStart', () => {
  it('highlights ready cards disjoint from in-flight work, not the ones that collide', () => {
    const result = safeToStart(
      model([
        { id: 'T-001', touches: ['core'], status: 'In Progress' }, // claims core
        { id: 'T-002', touches: ['web'], status: 'Todo' }, // ready, disjoint → safe
        { id: 'T-003', touches: ['core'], status: 'Todo' }, // ready, overlaps core → unsafe
      ]),
      makeFlightConfig(AREAS),
    );
    expect(result).toEqual(['T-002']);
  });

  it('leaves out cards with unfinished dependencies; an explicit empty surface is safe', () => {
    const result = safeToStart(
      model([
        { id: 'T-001', touches: ['core'], status: 'In Progress' },
        { id: 'T-002', touches: ['web'], status: 'Todo', dependsOn: ['T-004'] }, // not ready
        { id: 'T-004', touches: [], status: 'Todo' }, // ready, touches nothing → safe
      ]),
      makeFlightConfig(AREAS),
    );
    expect(result).toEqual(['T-004']);
  });

  it('sets aside an undeclared (no touches) ready card; it can claim no safety', () => {
    const result = safeToStart(
      model([
        { id: 'T-001', touches: ['core'], status: 'In Progress' },
        { id: 'T-002', status: 'Todo' }, // no touches → unknown surface → unsafe
        { id: 'T-003', touches: [], status: 'Todo' }, // explicit empty → safe
      ]),
      makeFlightConfig(AREAS),
    );
    expect(result).toEqual(['T-003']);
  });

  it('never marks an in-flight card "safe to start", even with an empty surface', () => {
    const result = safeToStart(
      model([
        { id: 'T-001', touches: [], status: 'In Progress' }, // already started
        { id: 'T-002', touches: ['web'], status: 'Todo' }, // ready, disjoint → safe
      ]),
      makeFlightConfig(AREAS),
    );
    expect(result).toEqual(['T-002']);
  });

  it('is empty when the vault configures no areas (zero-config silence)', () => {
    const result = safeToStart(
      model([
        { id: 'T-001', touches: ['core'], status: 'In Progress' },
        { id: 'T-002', status: 'Todo' },
      ]),
      makeFlightConfig(),
    );
    expect(result).toEqual([]);
  });

  it('is empty when the board has no in-flight column (fewer than 3 columns)', () => {
    const result = safeToStart(
      model([{ id: 'T-001', touches: ['web'], status: 'Todo' }]),
      makeConfig(AREAS), // two-column board
    );
    expect(result).toEqual([]);
  });

  it('accepts a prebuilt dependency graph, with the same result as building one', () => {
    const m = model([
      { id: 'T-001', touches: ['core'], status: 'In Progress' },
      { id: 'T-002', touches: ['web'], status: 'Todo' },
    ]);
    const config = makeFlightConfig(AREAS);
    const graph = buildDependencyGraph(m, config);
    expect(safeToStart(m, config, undefined, graph)).toEqual(safeToStart(m, config));
    expect(safeToStart(m, config, undefined, graph)).toEqual(['T-002']);
  });
});
