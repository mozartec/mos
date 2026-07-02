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
    feature: {
      label: 'Feature',
      parent: null,
      states: { Draft: 'Backlog' },
      card: { fields: ['priority', 'owner'] },
    },
    story: {
      label: 'Story',
      parent: 'feature',
      states: { Todo: 'Backlog' },
      card: { fields: ['priority', 'owner'] },
    },
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

  // ── F-020 opt-in facets: the defaults above stay byte-identical ────────────

  it('offers a status facet on request: every declared state, in order, deduped', () => {
    const withStates: VaultConfig = {
      ...config,
      types: {
        feature: {
          ...config.types['feature'],
          states: { Draft: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
        },
        story: {
          ...config.types['story'],
          states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
        },
      },
    };
    const status = buildFacets(withStates, cards, { status: true }).find(
      (f) => f.field === 'status',
    );
    // Feature's states first (declaration order), then story's unseen ones —
    // 'In Progress'/'Done' appear once despite both types declaring them.
    expect(status?.options.map((o) => o.value)).toEqual(['Draft', 'In Progress', 'Done', 'Todo']);
    // The facet sits right after type, ahead of the registry fields.
    expect(
      buildFacets(withStates, cards, { status: true })
        .map((f) => f.field)
        .slice(0, 2),
    ).toEqual(['type', 'status']);
  });

  it('offers the scope field as a facet on request, with its configured options', () => {
    const sprint = buildFacets(config, cards, { scope: true }).find((f) => f.field === 'sprint');
    expect(sprint?.label).toBe('Sprint');
    expect(sprint?.options.map((o) => o.value)).toEqual(['S1', 'S2']);
  });

  it('synthesizes the scope facet for a 0.3 alias vault with no registry entry', () => {
    // Top-level `sprints` only: the scope field exists purely via normalizeScope.
    const fieldsWithoutSprint = { ...config.fields };
    delete fieldsWithoutSprint['sprint'];
    const alias: VaultConfig = {
      ...config,
      fields: fieldsWithoutSprint,
      board: { ...config.board, scopeField: undefined },
      sprints: ['S1', 'S2'],
    };
    const sprint = buildFacets(alias, cards, { scope: true }).find((f) => f.field === 'sprint');
    expect(sprint?.options.map((o) => o.value)).toEqual(['S1', 'S2']);
    // And the default (board) call still excludes it.
    expect(buildFacets(alias, cards).map((f) => f.field)).not.toContain('sprint');
  });

  it('keeps the default facet set unchanged when no options are passed', () => {
    expect(buildFacets(config, cards).map((f) => f.field)).toEqual(['type', 'priority', 'owner']);
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

  it('filters by status via the promoted card property, not a frontmatter read', () => {
    // `status` never reaches fields here — the card() helper hardcodes the
    // promoted property to 'Todo' — so matching proves the intrinsic path.
    const out = applyFilters(cards, { q: '', values: { status: 'Todo' } }, config);
    expect(out).toHaveLength(3);
    expect(applyFilters(cards, { q: '', values: { status: 'Done' } }, config)).toEqual([]);
  });

  it('filters by a data-derived field (owner)', () => {
    const out = applyFilters(cards, { q: '', values: { owner: 'bob' } }, config);
    expect(out.map((c) => c.id)).toEqual(['F-2']);
  });

  it('free text matches id, title, and string fields like owner', () => {
    expect(applyFilters(cards, { q: 'reset', values: {} }, config).map((c) => c.id)).toEqual([
      'S-1',
    ]);
    expect(applyFilters(cards, { q: 'alice', values: {} }, config).map((c) => c.id)).toEqual([
      'F-1',
      'S-1',
    ]);
    expect(applyFilters(cards, { q: 'F-2', values: {} }, config).map((c) => c.id)).toEqual(['F-2']);
  });

  it('composes filters (AND across dimensions)', () => {
    const out = applyFilters(
      cards,
      { q: 'log', values: { type: 'feature', owner: 'alice' } },
      config,
    );
    expect(out.map((c) => c.id)).toEqual(['F-1']);
  });

  it('ignores empty selections', () => {
    expect(matchesFilters(cards[0], { q: '', values: { type: '', priority: '' } }, config)).toBe(
      true,
    );
  });
});
