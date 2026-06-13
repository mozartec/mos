import { describe, it, expect } from 'vitest';
import type { Card, VaultConfig } from './index.js';
import {
  buildFacets,
  matchesFilters,
  applyFilters,
  emptyFilterState,
  isFilterEmpty,
} from './filters.js';

const config: VaultConfig = {
  specVersion: '0.4',
  vault: { name: 'test' },
  meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
  fields: {
    id: { type: 'id' },
    title: { type: 'string' },
    status: { type: 'string' },
    priority: { type: 'enum', values: ['P0', 'P1', 'P2', 'P3'], label: 'Priority' },
    owner: { type: 'string', label: 'Owner' },
    sprint: { type: 'enum', source: 'sprints', label: 'Sprint' },
    created: { type: 'datetime' },
  },
  wiki: { include: [], exclude: [], fields: [] },
  board: {
    include: ['board/**'],
    columns: ['Backlog', 'In Progress', 'Done'],
    sortWithinColumn: ['priority', 'id'],
    scopeField: 'sprint',
  },
  references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
  types: {
    feature: { label: 'Feature', parent: null, states: { Draft: 'Backlog' }, card: { fields: ['priority', 'owner'] } },
    story: { label: 'Story', parent: 'feature', states: { Todo: 'Backlog' }, card: { fields: ['priority', 'owner'] } },
  },
  sprints: ['S1', 'S2'],
  areas: {},
  fieldOrder: [],
};

function card(id: string, type: string, fields: Record<string, unknown>): Card {
  return {
    id,
    type,
    title: String(fields['title'] ?? id),
    status: 'Todo',
    path: `board/${id}.md`,
    priority: typeof fields['priority'] === 'string' ? fields['priority'] : undefined,
    fields,
  };
}

const cards: Card[] = [
  card('F-1', 'feature', { title: 'Login', priority: 'P0', owner: 'alice' }),
  card('F-2', 'feature', { title: 'Logout', priority: 'P1', owner: 'bob' }),
  card('S-1', 'story', { title: 'Reset password', priority: 'P0', owner: 'alice' }),
];

describe('buildFacets', () => {
  it('offers a type facet with options from config.types', () => {
    const type = buildFacets(config, cards).find((f) => f.field === 'type');
    expect(type?.options.map((o) => o.value)).toEqual(['feature', 'story']);
    expect(type?.options.map((o) => o.label)).toEqual(['Feature', 'Story']);
  });

  it('offers a priority facet whose options come from config, not code', () => {
    const priority = buildFacets(config, cards).find((f) => f.field === 'priority');
    expect(priority?.options.map((o) => o.value)).toEqual(['P0', 'P1', 'P2', 'P3']);
    expect(priority?.options.map((o) => o.value)).toEqual(config.fields['priority'].values);
  });

  it('offers an owner facet with options derived from the cards present', () => {
    const owner = buildFacets(config, cards).find((f) => f.field === 'owner');
    expect(owner?.options.map((o) => o.value)).toEqual(['alice', 'bob']);
  });

  it('excludes the scope field, structural fields, and timestamps', () => {
    const fields = buildFacets(config, cards).map((f) => f.field);
    expect(fields).not.toContain('sprint'); // scope field
    expect(fields).not.toContain('created'); // timestamp
    expect(fields).not.toContain('id');
    expect(fields).not.toContain('status');
  });

  it('excludes the scope field even when it is resolved via the 0.3 sprints alias', () => {
    // No board.scopeField — `sprint` is the scope only through normalizeScope's alias.
    const alias: VaultConfig = {
      ...config,
      board: { ...config.board, scopeField: undefined },
      sprints: ['S1', 'S2'],
    };
    expect(buildFacets(alias, cards).map((f) => f.field)).not.toContain('sprint');
  });
});

describe('matchesFilters / applyFilters', () => {
  it('the empty state matches everything', () => {
    expect(isFilterEmpty(emptyFilterState())).toBe(true);
    expect(applyFilters(cards, emptyFilterState(), config)).toHaveLength(3);
  });

  it('filters by type', () => {
    const out = applyFilters(cards, { q: '', values: { type: 'story' } }, config);
    expect(out.map((c) => c.id)).toEqual(['S-1']);
  });

  it('filters by an enum field (priority)', () => {
    const out = applyFilters(cards, { q: '', values: { priority: 'P0' } }, config);
    expect(out.map((c) => c.id)).toEqual(['F-1', 'S-1']);
  });

  it('filters by a data-derived field (owner)', () => {
    const out = applyFilters(cards, { q: '', values: { owner: 'bob' } }, config);
    expect(out.map((c) => c.id)).toEqual(['F-2']);
  });

  it('free text matches id, title, and string fields like owner', () => {
    expect(applyFilters(cards, { q: 'reset', values: {} }, config).map((c) => c.id)).toEqual(['S-1']);
    expect(applyFilters(cards, { q: 'alice', values: {} }, config).map((c) => c.id)).toEqual(['F-1', 'S-1']);
    expect(applyFilters(cards, { q: 'F-2', values: {} }, config).map((c) => c.id)).toEqual(['F-2']);
  });

  it('composes filters (AND across dimensions)', () => {
    const out = applyFilters(cards, { q: 'log', values: { type: 'feature', owner: 'alice' } }, config);
    expect(out.map((c) => c.id)).toEqual(['F-1']);
  });

  it('ignores empty selections', () => {
    expect(matchesFilters(cards[0], { q: '', values: { type: '', priority: '' } }, config)).toBe(true);
  });
});
