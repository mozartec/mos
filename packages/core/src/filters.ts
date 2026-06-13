/**
 * Config-driven board/backlog filters (F-023).
 *
 * The set of filters and their options come from the vault config and the
 * loaded cards — never a hardcoded field list (ADR-003). A facet is offered for
 * the card **type**, for each non-list **enum** field (options from config),
 * and for each card-face **string** field such as `owner` (options derived from
 * the cards present). A free-text query matches the id, title, and string
 * fields. All pure (ADR-001) so the UI and any future lens (F-020) share it.
 */

import type { Card } from './models.js';
import type { ScopeValue, VaultConfig } from './config.js';

/** One selectable option in a facet. */
export interface FacetOption {
  value: string;
  label: string;
}

/** A filterable dimension: a card property and the options it can take. */
export interface Facet {
  /** `'type'`, or a frontmatter field name. */
  field: string;
  /** Display label for the control. */
  label: string;
  /** Allowed values; selecting one narrows to cards matching it. */
  options: FacetOption[];
}

/**
 * The current filter selection. `q` is the free-text query; `values` maps a
 * facet field to its selected value (absent or `''` = no filter on it).
 */
export interface FilterState {
  q: string;
  values: Record<string, string>;
}

/** The no-op filter: matches every card. */
export function emptyFilterState(): FilterState {
  return { q: '', values: {} };
}

/** True when `state` selects nothing — every card passes. */
export function isFilterEmpty(state: FilterState): boolean {
  return state.q.trim() === '' && Object.values(state.values).every((v) => v === '');
}

/**
 * Build the facets a vault offers, from its config and the cards present.
 * Order: type, then registry fields in declaration order. The scope field is
 * excluded (the board scopes by it via the switcher, not a filter).
 */
export function buildFacets(config: VaultConfig, cards: Card[]): Facet[] {
  const facets: Facet[] = [];

  const typeOptions = Object.entries(config.types).map(([key, def]) => ({
    value: key,
    label: def.label ?? key,
  }));
  if (typeOptions.length > 0) {
    facets.push({ field: 'type', label: 'Type', options: typeOptions });
  }

  const scopeField = config.board.scopeField;
  const face = cardFaceFields(config);
  const reserved = new Set<string>([
    'id',
    'title',
    'status',
    'type',
    config.meta.timestamps.createdField,
    config.meta.timestamps.updatedField,
  ]);

  for (const [name, def] of Object.entries(config.fields)) {
    if (name === scopeField || reserved.has(name)) continue;

    if (def.type === 'enum' && def.list !== true) {
      const values = resolveEnumValues(config, def.values, def.source);
      if (values.length > 0) {
        facets.push({
          field: name,
          label: def.label ?? name,
          options: values.map((v) => ({ value: v, label: v })),
        });
      }
    } else if (def.type === 'string' && face.has(name)) {
      // Data-derived options (e.g. `owner`): distinct values among the cards.
      const distinct = [
        ...new Set(
          cards
            .map((card) => card.fields[name])
            .filter((v): v is string => typeof v === 'string' && v !== ''),
        ),
      ].sort();
      if (distinct.length > 0) {
        facets.push({
          field: name,
          label: def.label ?? name,
          options: distinct.map((v) => ({ value: v, label: v })),
        });
      }
    }
  }

  return facets;
}

/** True when a card satisfies every active dimension of `state`. */
export function matchesFilters(card: Card, state: FilterState, config: VaultConfig): boolean {
  for (const [field, value] of Object.entries(state.values)) {
    if (value === '') continue;
    const actual = field === 'type' ? card.type : card.fields[field];
    if (String(actual ?? '') !== value) return false;
  }
  const q = state.q.trim().toLowerCase();
  if (q !== '' && !cardSearchText(card, config).includes(q)) return false;
  return true;
}

/** `cards` narrowed to those matching `state`, preserving input order. */
export function applyFilters(cards: Card[], state: FilterState, config: VaultConfig): Card[] {
  return cards.filter((card) => matchesFilters(card, state, config));
}

// ── internals ──────────────────────────────────────────────────────────────

/** Names referenced by any type's `card.fields`. */
function cardFaceFields(config: VaultConfig): Set<string> {
  const names = new Set<string>();
  for (const type of Object.values(config.types)) {
    for (const field of type.card?.fields ?? []) names.add(field);
  }
  return names;
}

/** An enum field's option names: inline `values`, else a `source` config list/map. */
function resolveEnumValues(
  config: VaultConfig,
  values: (string | ScopeValue)[] | undefined,
  source: string | undefined,
): string[] {
  if (Array.isArray(values) && values.length > 0) {
    return values.map((v) => (typeof v === 'string' ? v : v.name));
  }
  if (typeof source === 'string' && Object.hasOwn(config, source)) {
    const resolved = (config as unknown as Record<string, unknown>)[source];
    if (Array.isArray(resolved)) {
      return resolved.map((v) => (typeof v === 'string' ? v : (v as ScopeValue).name));
    }
    if (resolved !== null && typeof resolved === 'object') return Object.keys(resolved);
  }
  return [];
}

/** Lower-cased searchable text for a card: id, title, and string field values. */
function cardSearchText(card: Card, config: VaultConfig): string {
  const parts: string[] = [card.id, card.title];
  for (const [name, def] of Object.entries(config.fields)) {
    if (def.type !== 'string') continue;
    const value = card.fields[name];
    if (typeof value === 'string') parts.push(value);
  }
  return parts.join(' ').toLowerCase();
}
