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
import { enumValueEntries } from './config.js';
import { normalizeScope } from './scope.js';

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

/**
 * Opt-in facets beyond the board's default set (F-020). The defaults stay off
 * so the board's bar is byte-identical to F-023; the Cards lens turns both on.
 */
export interface FacetOptions {
  /**
   * Offer a `status` facet: every state name any type declares, in declaration
   * order. The board never wants it — its columns already fan cards out by
   * status — but a flat index has no columns to do that.
   */
  status?: boolean;
  /**
   * Offer the scope field like any other enum facet. The board excludes it
   * because its switcher owns that dimension (ADR-020); the Cards lens has no
   * switcher, so scope is a plain filter there.
   */
  scope?: boolean;
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
 * Order: type (then status, when opted in), then registry fields in
 * declaration order. The scope field is excluded (the board scopes by it via
 * the switcher, not a filter) unless `options.scope` asks for it.
 */
export function buildFacets(
  config: VaultConfig,
  cards: Card[],
  options: FacetOptions = {},
): Facet[] {
  const facets: Facet[] = [];

  const typeOptions = Object.entries(config.types).map(([key, def]) => ({
    value: key,
    label: def.label ?? key,
  }));
  if (typeOptions.length > 0) {
    facets.push({ field: 'type', label: 'Type', options: typeOptions });
  }

  if (options.status === true) {
    const states = statusValues(config);
    if (states.length > 0) {
      facets.push({
        field: 'status',
        label: 'Status',
        options: states.map((v) => ({ value: v, label: v })),
      });
    }
  }

  // Exclude the *resolved* scope field (the switcher owns it), which for a 0.3
  // alias vault is derived by normalizeScope rather than set in board.scopeField.
  const scope = normalizeScope(config);
  const scopeField = scope?.field;
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
    if (reserved.has(name)) continue;
    if (name === scopeField && options.scope !== true) continue;

    if (def.type === 'enum' && def.list !== true) {
      const values = enumValueEntries(config, def.values, def.source).map((v) =>
        typeof v === 'string' ? v : (v as ScopeValue).name,
      );
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

  // A 0.3 alias vault's scope field (top-level `sprints`, no registry entry)
  // never passes through the registry loop above — synthesize its facet from
  // the resolved ScopeDef so `{scope: true}` works for every scope shape.
  if (options.scope === true && scope !== null && !facets.some((f) => f.field === scope.field)) {
    const values = scope.values.map((v) => v.name);
    if (values.length > 0 && !reserved.has(scope.field)) {
      facets.push({
        field: scope.field,
        label: config.fields[scope.field]?.label ?? scope.field,
        options: values.map((v) => ({ value: v, label: v })),
      });
    }
  }

  return facets;
}

/**
 * The vault's whole status vocabulary: every state any type declares, in
 * declaration order, deduped — states shared across types appear once. The
 * single source behind the status facet's options and any status ordering
 * (e.g. the Cards lens's column sort), so the two can't drift (ADR-003).
 */
export function statusValues(config: VaultConfig): string[] {
  const states: string[] = [];
  for (const type of Object.values(config.types)) {
    for (const state of Object.keys(type.states ?? {})) {
      if (!states.includes(state)) states.push(state);
    }
  }
  return states;
}

/** True when a card satisfies every active dimension of `state`. */
export function matchesFilters(card: Card, state: FilterState, config: VaultConfig): boolean {
  for (const [field, value] of Object.entries(state.values)) {
    if (value === '') continue;
    // `type` and `status` are intrinsic card properties, not frontmatter reads
    // — matching the promoted values keeps the status facet honest even for a
    // card whose raw frontmatter omitted or malformed them.
    const actual =
      field === 'type' ? card.type : field === 'status' ? card.status : card.fields[field];
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
