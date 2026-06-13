import { describe, it, expect } from 'vitest';
import type { Card, VaultConfig } from './index.js';
import {
  normalizeScope,
  cardScopeValue,
  resolveCurrentScope,
  scopeDaysLeft,
  backlogCards,
} from './scope.js';

const NOW = Date.parse('2026-06-13T12:00:00Z'); // within S2 below

/** Build a config with the given overrides over a 3-column board. */
function makeConfig(over: Partial<VaultConfig> = {}): VaultConfig {
  return {
    specVersion: '0.4',
    vault: { name: 'test' },
    meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
    fields: {},
    wiki: { include: [], exclude: [], fields: [] },
    board: { include: ['board/**'], columns: ['Backlog', 'In Progress', 'Done'], sortWithinColumn: ['priority', 'id'] },
    references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
    types: {
      story: {
        parent: null,
        states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done', Deferred: null },
      },
    },
    sprints: [],
    areas: {},
    fieldOrder: [],
    ...over,
  };
}

function card(id: string, status: string, fields: Record<string, unknown> = {}, priority?: string): Card {
  return { id, type: 'story', title: id, status, path: `board/${id}.md`, priority, fields };
}

describe('normalizeScope', () => {
  it('reads an explicit scopeField with inline string values', () => {
    const config = makeConfig({
      board: { ...makeConfig().board, scopeField: 'cycle' },
      fields: { cycle: { type: 'enum', values: ['C1', 'C2'] } },
    });
    expect(normalizeScope(config)).toEqual({ field: 'cycle', values: [{ name: 'C1' }, { name: 'C2' }] });
  });

  it('reads inline dated values, keeping starts/ends', () => {
    const config = makeConfig({
      board: { ...makeConfig().board, scopeField: 'sprint' },
      fields: {
        sprint: {
          type: 'enum',
          values: [{ name: 'S1', starts: '2026-06-01', ends: '2026-06-07' }, 'S2'],
        },
      },
    });
    expect(normalizeScope(config)).toEqual({
      field: 'sprint',
      values: [{ name: 'S1', starts: '2026-06-01', ends: '2026-06-07' }, { name: 'S2' }],
    });
  });

  it('resolves values from a `source` config list (sprints)', () => {
    const config = makeConfig({
      board: { ...makeConfig().board, scopeField: 'sprint' },
      fields: { sprint: { type: 'enum', source: 'sprints' } },
      sprints: ['S1', 'S2', 'S3'],
    });
    expect(normalizeScope(config)?.values.map((v) => v.name)).toEqual(['S1', 'S2', 'S3']);
  });

  it('reads a 0.3 `sprints` key as a `sprint` scope when no scopeField is set', () => {
    const config = makeConfig({ sprints: ['S1', 'S2'] });
    expect(normalizeScope(config)).toEqual({ field: 'sprint', values: [{ name: 'S1' }, { name: 'S2' }] });
  });

  it('is null for a vault with no scopeField and no sprints (unscoped)', () => {
    expect(normalizeScope(makeConfig())).toBeNull();
  });

  it('is null when scopeField names a missing or non-enum field', () => {
    const missing = makeConfig({ board: { ...makeConfig().board, scopeField: 'nope' } });
    expect(normalizeScope(missing)).toBeNull();
    const notEnum = makeConfig({
      board: { ...makeConfig().board, scopeField: 'owner' },
      fields: { owner: { type: 'string' } },
    });
    expect(normalizeScope(notEnum)).toBeNull();
  });

  it('is null when the scope has no usable values', () => {
    const config = makeConfig({
      board: { ...makeConfig().board, scopeField: 'cycle' },
      fields: { cycle: { type: 'enum', values: [] } },
    });
    expect(normalizeScope(config)).toBeNull();
  });

  it('drops malformed dates during normalization, keeping the name', () => {
    const config = makeConfig({
      board: { ...makeConfig().board, scopeField: 'sprint' },
      fields: { sprint: { type: 'enum', values: [{ name: 'S1', starts: 'not-a-date', ends: '2026-13-99' }] } },
    });
    expect(normalizeScope(config)).toEqual({ field: 'sprint', values: [{ name: 'S1' }] });
  });
});

describe('cardScopeValue', () => {
  const scope = { field: 'sprint', values: [{ name: 'S1' }] };
  it('reads the card field, or "" when absent/non-string', () => {
    expect(cardScopeValue(card('A', 'Todo', { sprint: 'S1' }), scope)).toBe('S1');
    expect(cardScopeValue(card('B', 'Todo', {}), scope)).toBe('');
    expect(cardScopeValue(card('C', 'Todo', { sprint: 42 }), scope)).toBe('');
  });
});

describe('resolveCurrentScope', () => {
  const datedConfig = makeConfig({
    board: { ...makeConfig().board, scopeField: 'sprint' },
    fields: {
      sprint: {
        type: 'enum',
        values: [
          { name: 'S1', starts: '2026-06-01', ends: '2026-06-07' },
          { name: 'S2', starts: '2026-06-08', ends: '2026-06-21' },
          { name: 'S3', starts: '2026-06-22', ends: '2026-07-05' },
        ],
      },
    },
  });

  it('picks the date-current value (dates win)', () => {
    const scope = normalizeScope(datedConfig)!;
    expect(resolveCurrentScope(scope, [], datedConfig, NOW)).toBe('S2');
  });

  it('falls back to the last value with an unfinished card when no dates apply', () => {
    const config = makeConfig({
      board: { ...makeConfig().board, scopeField: 'sprint' },
      fields: { sprint: { type: 'enum', values: ['S1', 'S2', 'S3'] } },
    });
    const scope = normalizeScope(config)!;
    const cards = [card('A', 'Done', { sprint: 'S3' }), card('B', 'Todo', { sprint: 'S2' })];
    expect(resolveCurrentScope(scope, cards, config, NOW)).toBe('S2');
  });

  it('falls back to lastSelection when valid and no dates/unfinished apply', () => {
    const config = makeConfig({
      board: { ...makeConfig().board, scopeField: 'sprint' },
      fields: { sprint: { type: 'enum', values: ['S1', 'S2', 'S3'] } },
    });
    const scope = normalizeScope(config)!;
    expect(resolveCurrentScope(scope, [], config, NOW, 'S1')).toBe('S1');
  });

  it('defaults to the last configured value when nothing else applies', () => {
    const config = makeConfig({
      board: { ...makeConfig().board, scopeField: 'sprint' },
      fields: { sprint: { type: 'enum', values: ['S1', 'S2', 'S3'] } },
    });
    const scope = normalizeScope(config)!;
    expect(resolveCurrentScope(scope, [], config, NOW, 'unknown')).toBe('S3');
  });
});

describe('scopeDaysLeft', () => {
  it('counts whole days to the end (inclusive)', () => {
    expect(scopeDaysLeft({ name: 'S2', starts: '2026-06-08', ends: '2026-06-21' }, NOW)).toBe(8);
  });
  it('is null with no end date', () => {
    expect(scopeDaysLeft({ name: 'S2' }, NOW)).toBeNull();
  });
  it('is 0 on the last day', () => {
    expect(scopeDaysLeft({ name: 'today', ends: '2026-06-13' }, NOW)).toBe(0);
  });
  it('is negative once the end day has passed (ended, not "last day")', () => {
    expect(scopeDaysLeft({ name: 'past', ends: '2026-06-01' }, NOW)).toBe(-12);
  });
});

describe('backlogCards', () => {
  const scope = { field: 'sprint', values: [{ name: 'S1' }] };
  it('lists empty-scope, not-done, not-hidden cards ranked by priority then id, regardless of column', () => {
    const cards = [
      card('A', 'Todo', {}, 'P1'), // backlog (Backlog column)
      card('E', 'In Progress', {}, 'P0'), // backlog (different column)
      card('B', 'Done', {}, 'P0'), // excluded: done
      card('C', 'Deferred', {}, 'P0'), // excluded: hidden
      card('D', 'Todo', { sprint: 'S1' }, 'P0'), // excluded: scoped
    ];
    expect(backlogCards(cards, makeConfig(), scope).map((c) => c.id)).toEqual(['E', 'A']);
  });
});
