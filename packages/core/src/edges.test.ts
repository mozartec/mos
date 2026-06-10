import { describe, expect, it } from 'vitest';
import type { VaultConfig } from './config.js';
import type { Card, VaultModel } from './models.js';
import { buildEdges, deriveBlocks } from './edges.js';

const config: VaultConfig = {
  specVersion: '0.3',
  vault: { name: 'test' },
  meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
  fields: {
    dependsOn: { type: 'id', list: true, label: 'Depends on' },
  },
  wiki: { include: [], exclude: [], fields: [] },
  board: { include: ['board/**'], columns: ['Backlog', 'Done'], sortWithinColumn: [] },
  references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
  types: {
    task: { parent: null, states: { Todo: 'Backlog', Done: 'Done' } },
  },
  sprints: [],
  fieldOrder: [],
};

function model(cards: Array<{ id: string; dependsOn?: unknown }>): VaultModel {
  const entries: Record<string, Card> = {};
  for (const c of cards) {
    entries[c.id] = {
      id: c.id,
      type: 'task',
      title: c.id,
      status: 'Todo',
      path: `board/${c.id}.md`,
      fields: c.dependsOn === undefined ? {} : { dependsOn: c.dependsOn },
    };
  }
  return { cards: entries, files: [] };
}

describe('buildEdges', () => {
  it('resolves valid dependsOn lists into edges, in deterministic order', () => {
    const { edges, errors } = buildEdges(
      model([
        { id: 'T-001' },
        { id: 'T-002', dependsOn: ['T-001'] },
        { id: 'T-003', dependsOn: ['T-001', 'T-002'] },
      ]),
      config,
    );
    expect(errors).toEqual([]);
    expect(edges).toEqual([
      { from: 'T-002', to: 'T-001' },
      { from: 'T-003', to: 'T-001' },
      { from: 'T-003', to: 'T-002' },
    ]);
  });

  it('reports an unresolved id in errors, not thrown', () => {
    const { edges, errors } = buildEdges(
      model([{ id: 'T-001', dependsOn: ['T-404'] }]),
      config,
    );
    expect(edges).toEqual([]);
    expect(errors).toEqual(["T-001: dependsOn 'T-404' does not resolve to a card"]);
  });

  it('reports a self-reference as a cycle', () => {
    const { errors } = buildEdges(model([{ id: 'T-001', dependsOn: ['T-001'] }]), config);
    expect(errors.some((e) => e.includes('dependency cycle: T-001 → T-001'))).toBe(true);
  });

  it('detects a two-card cycle and still returns the edges', () => {
    const { edges, errors } = buildEdges(
      model([
        { id: 'T-001', dependsOn: ['T-002'] },
        { id: 'T-002', dependsOn: ['T-001'] },
      ]),
      config,
    );
    expect(edges).toHaveLength(2);
    expect(errors.some((e) => e.startsWith('dependency cycle:'))).toBe(true);
  });

  it('a card with no dependsOn contributes no edges and no errors', () => {
    const { edges, errors } = buildEdges(model([{ id: 'T-001' }, { id: 'T-002' }]), config);
    expect(edges).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('accepts a scalar value as a single-entry list', () => {
    const { edges, errors } = buildEdges(
      model([{ id: 'T-001' }, { id: 'T-002', dependsOn: 'T-001' }]),
      config,
    );
    expect(errors).toEqual([]);
    expect(edges).toEqual([{ from: 'T-002', to: 'T-001' }]);
  });

  it('reports non-id entries instead of guessing', () => {
    const { errors } = buildEdges(model([{ id: 'T-001', dependsOn: [42] }]), config);
    expect(errors).toEqual(['T-001: dependsOn entry is not an id (42)']);
  });

  it('flags a registry entry of the wrong shape (ADR-003)', () => {
    const badConfig: VaultConfig = {
      ...config,
      fields: { dependsOn: { type: 'string' } },
    };
    const { errors } = buildEdges(model([{ id: 'T-001' }]), badConfig);
    expect(errors.some((e) => e.includes('expected a list-of-id field'))).toBe(true);
  });
});

describe('deriveBlocks', () => {
  it('derives the inverse blocks view from edges (never stored)', () => {
    const blocks = deriveBlocks([
      { from: 'T-002', to: 'T-001' },
      { from: 'T-003', to: 'T-001' },
    ]);
    expect(blocks).toEqual({ 'T-001': ['T-002', 'T-003'] });
  });
});
