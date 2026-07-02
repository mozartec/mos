import { loadConfig } from '@mos/core';
import type { Card } from '@mos/core';
import {
  DEFAULT_SORT,
  buildCardsColumns,
  parseSort,
  serializeSort,
  sortCards,
} from './cards-columns';

/** A vault whose declared orders deliberately disagree with alphabetics. */
const { config } = loadConfig(
  JSON.stringify({
    specVersion: '0.4',
    board: { include: ['board/**'], columns: ['Later', 'Now', 'Shipped'] },
    fields: {
      severity: { type: 'enum', values: ['high', 'medium', 'low'], label: 'Severity' },
      touches: { type: 'enum', source: 'areas', list: true, label: 'Touches' },
      owner: { type: 'string', label: 'Owner' },
      updated: { type: 'datetime', label: 'Updated' },
    },
    areas: { core: ['packages/core/**'], api: ['apps/api/**'], web: ['apps/web/**'] },
    types: {
      // Labels reverse the key order, so label-vs-key sorting is observable.
      bug: {
        label: 'Zebra',
        states: { Waiting: 'Later', Doing: 'Now', Shipped: 'Shipped' },
        card: { fields: ['severity', 'touches', 'updated'] },
      },
      story: {
        label: 'Alpha',
        states: { Waiting: 'Later', Review: 'Now', Shipped: 'Shipped' },
        card: { fields: ['owner', 'updated'] },
      },
    },
  }),
);

function card(
  id: string,
  type: string,
  status: string,
  fields: Record<string, unknown> = {},
): Card {
  return { id, type, title: String(fields['title'] ?? id), status, path: `board/${id}.md`, fields };
}

const ids = (cards: Card[]) => cards.map((c) => c.id);

describe('buildCardsColumns', () => {
  it('derives intrinsics plus the card-face union in registry declaration order', () => {
    expect(buildCardsColumns(config).map((c) => c.field)).toEqual([
      'id',
      'type',
      'title',
      'status',
      'severity',
      'touches',
      'owner',
      'updated',
    ]);
    expect(buildCardsColumns(config).map((c) => c.label)).toContain('Severity');
  });
});

describe('parseSort / serializeSort', () => {
  it('round-trips field and direction, treating the default as no param', () => {
    expect(parseSort(null)).toEqual(DEFAULT_SORT);
    expect(parseSort('updated')).toEqual({ field: 'updated', desc: false });
    expect(parseSort('-updated')).toEqual({ field: 'updated', desc: true });
    expect(serializeSort({ field: 'updated', desc: true })).toBe('-updated');
    expect(serializeSort(DEFAULT_SORT)).toBeNull();
  });
});

describe('sortCards', () => {
  it('sorts an enum column by declared value order, not alphabetics', () => {
    const cards = [
      card('C-1', 'bug', 'Doing', { severity: 'low' }),
      card('C-2', 'bug', 'Doing', { severity: 'high' }),
      card('C-3', 'bug', 'Doing', { severity: 'medium' }),
    ];
    // Declared: high < medium < low (alphabetics would say high < low < medium).
    expect(ids(sortCards(cards, { field: 'severity', desc: false }, config))).toEqual([
      'C-2',
      'C-3',
      'C-1',
    ]);
  });

  it('ranks a list-enum value by its first entry, so multi-value cards group sanely', () => {
    const cards = [
      card('C-1', 'bug', 'Doing', { touches: ['web'] }),
      card('C-2', 'bug', 'Doing', { touches: ['core', 'web'] }),
      card('C-3', 'bug', 'Doing', { touches: ['api'] }),
      card('C-4', 'bug', 'Doing', { touches: ['core'] }),
    ];
    // Areas declare core < api < web; [core, web] sorts with the core group,
    // after the bare [core] (joined-text tie-break), never dead last.
    expect(ids(sortCards(cards, { field: 'touches', desc: false }, config))).toEqual([
      'C-4',
      'C-2',
      'C-3',
      'C-1',
    ]);
  });

  it("sorts the status column by the types' state declaration order (the facet's vocabulary)", () => {
    const cards = [
      card('C-1', 'bug', 'Shipped'),
      card('C-2', 'story', 'Review'),
      card('C-3', 'bug', 'Doing'),
      card('C-4', 'bug', 'Waiting'),
    ];
    // Declaration order: Waiting, Doing, Shipped, Review — not alphabetical.
    expect(ids(sortCards(cards, { field: 'status', desc: false }, config))).toEqual([
      'C-4',
      'C-3',
      'C-1',
      'C-2',
    ]);
  });

  it('sorts the type column by the displayed label, matching what the cell shows', () => {
    const cards = [card('C-1', 'bug', 'Doing'), card('C-2', 'story', 'Review')];
    // Keys say bug < story, but the cells show Zebra and Alpha.
    expect(ids(sortCards(cards, { field: 'type', desc: false }, config))).toEqual(['C-2', 'C-1']);
  });

  it('sorts datetimes chronologically even when lexicographic order disagrees', () => {
    const cards = [
      // Same instant expressed later lexicographically vs an earlier instant.
      card('C-1', 'bug', 'Doing', { updated: '2026-01-02T00:00:00+05:00' }), // = 01-01T19:00Z
      card('C-2', 'bug', 'Doing', { updated: '2026-01-01T22:00:00Z' }),
      card('C-3', 'bug', 'Doing', { updated: '2026-01-01T00:00:00Z' }),
    ];
    // Lexicographically C-2 < C-1; chronologically C-1 (19:00Z) < C-2 (22:00Z).
    expect(ids(sortCards(cards, { field: 'updated', desc: false }, config))).toEqual([
      'C-3',
      'C-1',
      'C-2',
    ]);
  });

  it('sinks missing values to the bottom in both directions', () => {
    const cards = [
      card('C-1', 'story', 'Review', { owner: 'zoe' }),
      card('C-2', 'story', 'Review'),
      card('C-3', 'story', 'Review', { owner: 'ada' }),
    ];
    expect(ids(sortCards(cards, { field: 'owner', desc: false }, config))).toEqual([
      'C-3',
      'C-1',
      'C-2',
    ]);
    // Descending flips the present values but the empty row stays last.
    expect(ids(sortCards(cards, { field: 'owner', desc: true }, config))).toEqual([
      'C-1',
      'C-3',
      'C-2',
    ]);
  });

  it('orders out-of-vocabulary enum values after every declared one', () => {
    const cards = [
      card('C-1', 'bug', 'Doing', { severity: 'wat' }),
      card('C-2', 'bug', 'Doing', { severity: 'low' }),
    ];
    expect(ids(sortCards(cards, { field: 'severity', desc: false }, config))).toEqual([
      'C-2',
      'C-1',
    ]);
  });

  it('does not mutate the input array', () => {
    const cards = [card('B', 'bug', 'Doing'), card('A', 'bug', 'Doing')];
    sortCards(cards, DEFAULT_SORT, config);
    expect(ids(cards)).toEqual(['B', 'A']);
  });
});
