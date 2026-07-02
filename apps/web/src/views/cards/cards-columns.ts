import { enumValueEntries, statusValues } from '@mos/core';
import type { Card, FieldType, ScopeValue, VaultConfig } from '@mos/core';

/**
 * Pure column-model and ordering helpers for the Cards lens (F-020). All
 * derivation is from the vault config — a vault with custom types/fields gets
 * a correct table with zero code changes (ADR-003). Kept beside the view (not
 * in core): which columns a table shows is presentation, like the board's
 * card-face rendering.
 */

/** One column of the cards table: a card property and its display label. */
export interface CardsColumn {
  /** `'id' | 'type' | 'title' | 'status'`, or a frontmatter field name. */
  field: string;
  label: string;
}

/** The intrinsic properties every card has, heading the table. */
const INTRINSIC: readonly CardsColumn[] = [
  { field: 'id', label: 'ID' },
  { field: 'type', label: 'Type' },
  { field: 'title', label: 'Title' },
  { field: 'status', label: 'Status' },
];

/**
 * Derive the table's columns: the intrinsic properties, then every field any
 * type's `card.fields` names — the same face fields the board cards show —
 * in the fields-registry declaration order. A field a type doesn't declare
 * simply renders blank on that type's rows.
 */
export function buildCardsColumns(config: VaultConfig): CardsColumn[] {
  const face = new Set<string>();
  for (const type of Object.values(config.types)) {
    for (const field of type.card?.fields ?? []) face.add(field);
  }
  const intrinsic = new Set(INTRINSIC.map((column) => column.field));
  const columns = [...INTRINSIC];
  for (const [name, def] of Object.entries(config.fields)) {
    if (!face.has(name) || intrinsic.has(name)) continue;
    columns.push({ field: name, label: def.label ?? name });
  }
  return columns;
}

/** A parsed `?sort=` value: the column field and direction. */
export interface SortState {
  field: string;
  desc: boolean;
}

/** The default order: id, ascending — stable and meaningful in every vault. */
export const DEFAULT_SORT: SortState = { field: 'id', desc: false };

/** Parse `?sort=updated` / `?sort=-updated`; absent or blank → the default. */
export function parseSort(raw: string | null): SortState {
  if (raw === null || raw === '') return DEFAULT_SORT;
  return raw.startsWith('-') ? { field: raw.slice(1), desc: true } : { field: raw, desc: false };
}

/** Serialize for the URL; `null` (drop the param) for the default order. */
export function serializeSort(sort: SortState): string | null {
  if (sort.field === DEFAULT_SORT.field && sort.desc === DEFAULT_SORT.desc) return null;
  return sort.desc ? `-${sort.field}` : sort.field;
}

/**
 * Order cards for the table. Enum columns sort by their declared value order
 * (P0 before P1 because config says so — ADR-003; a list value ranks by its
 * first entry), `status` by the types' state declaration order (the same
 * vocabulary the status facet offers), `type` by the label the cell displays,
 * date columns chronologically, everything else as text. Missing values sink
 * to the bottom in either direction, and id breaks ties, so the order is
 * total and deterministic. Returns a new array; the input is not mutated.
 */
export function sortCards(cards: Card[], sort: SortState, config: VaultConfig): Card[] {
  const rank = rankFor(sort.field, config);
  const type = config.fields[sort.field]?.type;
  const result = [...cards];
  result.sort((a, b) => {
    const aValue = valueOf(a, sort.field, config);
    const bValue = valueOf(b, sort.field, config);
    const aEmpty = isEmptyValue(aValue);
    const bEmpty = isEmptyValue(bValue);
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    let cmp = aEmpty ? 0 : compareValues(aValue, bValue, rank, type);
    if (sort.desc) cmp = -cmp;
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
  return result;
}

// ── internals ──────────────────────────────────────────────────────────────

/**
 * A column's raw value: the promoted property, else the frontmatter field.
 * `type` compares by the label the cell displays — sorting by the raw key
 * would contradict the visible order (and the header's `aria-sort`) in a
 * vault whose labels order differently.
 */
function valueOf(card: Card, field: string, config: VaultConfig): unknown {
  if (field === 'id') return card.id;
  if (field === 'type') return config.types[card.type]?.label ?? card.type;
  if (field === 'title') return card.title;
  if (field === 'status') return card.status;
  return card.fields[field];
}

function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Declared-order index for a column, else null. Enum columns rank by their
 * declared values (inline or source); `status` ranks by the types' state
 * declaration order — the same vocabulary the status facet offers, so the
 * sort and the filter can't disagree (ADR-003).
 */
function rankFor(field: string, config: VaultConfig): Map<string, number> | null {
  if (field === 'status') {
    return new Map(statusValues(config).map((name, index) => [name, index]));
  }
  const def = config.fields[field];
  if (def?.type !== 'enum') return null;
  const names = enumValueEntries(config, def.values, def.source).map((entry) =>
    typeof entry === 'string' ? entry : (entry as ScopeValue).name,
  );
  return new Map(names.map((name, index) => [name, index]));
}

function compareValues(
  a: unknown,
  b: unknown,
  rank: Map<string, number> | null,
  type: FieldType | undefined,
): number {
  if (rank !== null) {
    // A list value ranks by its first entry ([core, web] sorts with core);
    // out-of-vocabulary values order after every declared one, then as text.
    const aIndex = rank.get(rankKey(a)) ?? rank.size;
    const bIndex = rank.get(rankKey(b)) ?? rank.size;
    if (aIndex !== bIndex) return aIndex - bIndex;
  }
  if (type === 'datetime' || type === 'date') {
    const aTime = Date.parse(String(a));
    const bTime = Date.parse(String(b));
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return aTime - bTime;
  }
  const aText = Array.isArray(a) ? a.join(', ') : String(a);
  const bText = Array.isArray(b) ? b.join(', ') : String(b);
  return aText.localeCompare(bText);
}

/** The value a rank lookup keys on: a list's first entry, else the value. */
function rankKey(value: unknown): string {
  return Array.isArray(value) ? String(value[0]) : String(value);
}
