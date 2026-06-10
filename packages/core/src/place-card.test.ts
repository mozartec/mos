import { describe, it, expect } from 'vitest';
import type { Card, VaultConfig } from './index.js';
import { placeCard, sortWithinColumn } from './place-card.js';

// Minimal valid config for testing
const testConfig: VaultConfig = {
  specVersion: '0.2',
  vault: { name: 'test' },
  meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
  fields: {},
  wiki: { include: [], exclude: [], fields: [] },
  board: {
    include: ['board/**'],
    columns: ['Backlog', 'In Progress', 'Done'],
    sortWithinColumn: ['priority', 'id'],
  },
  references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
  types: {
    story: {
      label: 'Story',
      parent: 'feature',
      states: {
        Todo: 'Backlog',
        'In Progress': 'In Progress',
        Done: 'Done',
        Blocked: 'In Progress',
        Deferred: null,
        Dropped: null,
      },
      card: { fields: ['priority'] },
    },
    feature: {
      label: 'Feature',
      parent: null,
      states: {
        Backlog: 'Backlog',
        Active: 'In Progress',
        Done: 'Done',
      },
    },
  },
  sprints: ['S1', 'S2'],
  fieldOrder: [],
};

describe('placeCard', () => {
  it('places a Todo story in Backlog', () => {
    const card: Card = {
      id: 'F-001-S-01',
      type: 'story',
      title: 'Test story',
      status: 'Todo',
      path: 'board/F-001-S-01.md',
    };
    const result = placeCard(card, testConfig);
    expect(result).toEqual({ column: 'Backlog', blocked: false });
  });

  it('places an In Progress story in In Progress column', () => {
    const card: Card = {
      id: 'F-001-S-02',
      type: 'story',
      title: 'Another story',
      status: 'In Progress',
      path: 'board/F-001-S-02.md',
    };
    const result = placeCard(card, testConfig);
    expect(result).toEqual({ column: 'In Progress', blocked: false });
  });

  it('places a Blocked story in In Progress but sets blocked flag', () => {
    const card: Card = {
      id: 'F-001-S-03',
      type: 'story',
      title: 'Blocked story',
      status: 'Blocked',
      path: 'board/F-001-S-03.md',
    };
    const result = placeCard(card, testConfig);
    expect(result).toEqual({ column: 'In Progress', blocked: true });
  });

  it('hides a Deferred story (null column)', () => {
    const card: Card = {
      id: 'F-001-S-04',
      type: 'story',
      title: 'Deferred story',
      status: 'Deferred',
      path: 'board/F-001-S-04.md',
    };
    const result = placeCard(card, testConfig);
    expect(result).toEqual({ column: null, blocked: false });
  });

  it('hides a Dropped story (null column)', () => {
    const card: Card = {
      id: 'F-001-S-05',
      type: 'story',
      title: 'Dropped story',
      status: 'Dropped',
      path: 'board/F-001-S-05.md',
    };
    const result = placeCard(card, testConfig);
    expect(result).toEqual({ column: null, blocked: false });
  });

  it('handles multiple states sharing a column', () => {
    const card1: Card = {
      id: 'F-001-S-06',
      type: 'story',
      title: 'In Progress story',
      status: 'In Progress',
      path: 'board/F-001-S-06.md',
    };
    const card2: Card = {
      id: 'F-001-S-07',
      type: 'story',
      title: 'Blocked story',
      status: 'Blocked',
      path: 'board/F-001-S-07.md',
    };
    expect(placeCard(card1, testConfig).column).toBe('In Progress');
    expect(placeCard(card2, testConfig).column).toBe('In Progress');
  });

  it('returns an error result on unknown type (never throws)', () => {
    const card: Card = {
      id: 'X-001',
      type: 'unknown',
      title: 'Bad card',
      status: 'Todo',
      path: 'board/X-001.md',
    };
    const result = placeCard(card, testConfig);
    expect(result.column).toBeNull();
    expect(result.blocked).toBe(false);
    expect(result.error).toContain("Unknown card type 'unknown'");
  });

  it('returns an error result on unknown status (never throws)', () => {
    const card: Card = {
      id: 'F-001-S-08',
      type: 'story',
      title: 'Bad status card',
      status: 'UnknownStatus',
      path: 'board/F-001-S-08.md',
    };
    const result = placeCard(card, testConfig);
    expect(result.column).toBeNull();
    expect(result.error).toContain("Unknown status 'UnknownStatus'");
  });

  it('reports card id in error messages', () => {
    const card: Card = {
      id: 'F-002-S-01',
      type: 'unknown',
      title: 'Test',
      status: 'Todo',
      path: 'board/F-002-S-01.md',
    };
    expect(placeCard(card, testConfig).error).toContain('F-002-S-01');
  });

  it('omits error on successful placement', () => {
    const card: Card = {
      id: 'F-001-S-01',
      type: 'story',
      title: 'Good card',
      status: 'Todo',
      path: 'board/F-001-S-01.md',
    };
    expect(placeCard(card, testConfig).error).toBeUndefined();
  });
});

describe('sortWithinColumn', () => {
  it('sorts by priority rank (P0 < P1 < P2 < P3)', () => {
    const cards: Card[] = [
      { id: 'T-003', type: 'story', title: 'P1', status: 'Todo', path: 'b/3.md', priority: 'P1' },
      { id: 'T-001', type: 'story', title: 'P0', status: 'Todo', path: 'b/1.md', priority: 'P0' },
      { id: 'T-004', type: 'story', title: 'P3', status: 'Todo', path: 'b/4.md', priority: 'P3' },
      { id: 'T-002', type: 'story', title: 'P2', status: 'Todo', path: 'b/2.md', priority: 'P2' },
    ];
    const sorted = sortWithinColumn(cards, testConfig);
    expect(sorted.map((c) => c.id)).toEqual(['T-001', 'T-003', 'T-002', 'T-004']);
  });

  it('sorts by id when priorities are equal', () => {
    const cards: Card[] = [
      { id: 'T-003', type: 'story', title: '', status: 'Todo', path: 'b/3.md', priority: 'P1' },
      { id: 'T-001', type: 'story', title: '', status: 'Todo', path: 'b/1.md', priority: 'P1' },
      { id: 'T-002', type: 'story', title: '', status: 'Todo', path: 'b/2.md', priority: 'P1' },
    ];
    const sorted = sortWithinColumn(cards, testConfig);
    expect(sorted.map((c) => c.id)).toEqual(['T-001', 'T-002', 'T-003']);
  });

  it('handles missing priority (sorts last)', () => {
    const cards: Card[] = [
      { id: 'T-002', type: 'story', title: '', status: 'Todo', path: 'b/2.md' }, // no priority
      { id: 'T-001', type: 'story', title: '', status: 'Todo', path: 'b/1.md', priority: 'P0' },
      { id: 'T-003', type: 'story', title: '', status: 'Todo', path: 'b/3.md', priority: 'P1' },
    ];
    const sorted = sortWithinColumn(cards, testConfig);
    expect(sorted.map((c) => c.id)).toEqual(['T-001', 'T-003', 'T-002']);
  });

  it('handles unknown priority (sorts last)', () => {
    const cards: Card[] = [
      { id: 'T-002', type: 'story', title: '', status: 'Todo', path: 'b/2.md', priority: 'P99' },
      { id: 'T-001', type: 'story', title: '', status: 'Todo', path: 'b/1.md', priority: 'P0' },
    ];
    const sorted = sortWithinColumn(cards, testConfig);
    expect(sorted.map((c) => c.id)).toEqual(['T-001', 'T-002']);
  });

  it('returns a new array (does not mutate input)', () => {
    const cards: Card[] = [
      { id: 'T-002', type: 'story', title: '', status: 'Todo', path: 'b/2.md', priority: 'P1' },
      { id: 'T-001', type: 'story', title: '', status: 'Todo', path: 'b/1.md', priority: 'P0' },
    ];
    const sorted = sortWithinColumn(cards, testConfig);
    expect(sorted).not.toBe(cards);
    expect(cards[0].id).toBe('T-002'); // original unchanged
    expect(sorted[0].id).toBe('T-001');
  });

  it('handles empty array', () => {
    const cards: Card[] = [];
    const sorted = sortWithinColumn(cards, testConfig);
    expect(sorted).toEqual([]);
  });

  it('handles single card', () => {
    const cards: Card[] = [
      { id: 'T-001', type: 'story', title: '', status: 'Todo', path: 'b/1.md', priority: 'P0' },
    ];
    const sorted = sortWithinColumn(cards, testConfig);
    expect(sorted.map((c) => c.id)).toEqual(['T-001']);
  });

  it('respects custom sortWithinColumn config order', () => {
    const config = { ...testConfig, board: { ...testConfig.board, sortWithinColumn: ['id'] } };
    const cards: Card[] = [
      { id: 'T-003', type: 'story', title: '', status: 'Todo', path: 'b/3.md', priority: 'P0' },
      { id: 'T-001', type: 'story', title: '', status: 'Todo', path: 'b/1.md', priority: 'P3' },
      { id: 'T-002', type: 'story', title: '', status: 'Todo', path: 'b/2.md', priority: 'P1' },
    ];
    const sorted = sortWithinColumn(cards, config);
    // Should sort by id only, ignoring priority
    expect(sorted.map((c) => c.id)).toEqual(['T-001', 'T-002', 'T-003']);
  });

  it('respects reversed priority rank from config.fields.priority.values', () => {
    const reversedConfig: VaultConfig = {
      ...testConfig,
      fields: {
        priority: { type: 'enum', values: ['P3', 'P2', 'P1', 'P0'] },
      },
    };
    const cards: Card[] = [
      { id: 'T-001', type: 'story', title: '', status: 'Todo', path: 'b/1.md', priority: 'P0' },
      { id: 'T-002', type: 'story', title: '', status: 'Todo', path: 'b/2.md', priority: 'P3' },
      { id: 'T-003', type: 'story', title: '', status: 'Todo', path: 'b/3.md', priority: 'P1' },
    ];
    const sorted = sortWithinColumn(cards, reversedConfig);
    // Reversed config means P3 < P2 < P1 < P0
    expect(sorted.map((c) => c.id)).toEqual(['T-002', 'T-003', 'T-001']);
  });

  it('falls back to default priority rank when fields.priority is absent', () => {
    const noFieldsConfig: VaultConfig = {
      ...testConfig,
      fields: {}, // priority field not defined
    };
    const cards: Card[] = [
      { id: 'T-003', type: 'story', title: '', status: 'Todo', path: 'b/3.md', priority: 'P1' },
      { id: 'T-001', type: 'story', title: '', status: 'Todo', path: 'b/1.md', priority: 'P0' },
      { id: 'T-004', type: 'story', title: '', status: 'Todo', path: 'b/4.md', priority: 'P3' },
      { id: 'T-002', type: 'story', title: '', status: 'Todo', path: 'b/2.md', priority: 'P2' },
    ];
    const sorted = sortWithinColumn(cards, noFieldsConfig);
    // Should use default: P0 < P1 < P2 < P3
    expect(sorted.map((c) => c.id)).toEqual(['T-001', 'T-003', 'T-002', 'T-004']);
  });
});
