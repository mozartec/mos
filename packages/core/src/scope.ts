/**
 * Board scope: a config-named grouping of cards (VAULT_SPEC §5d, ADR-020).
 *
 * A vault designates an enum field as the board's scope (`board.scopeField`,
 * e.g. `sprint`, `cycle`, `iteration`); that field's values are the scope
 * vocabulary, optionally date-boxed. For backward compatibility a 0.3 vault
 * with a `sprints` key is read as a `sprint` scope.
 *
 * Everything here is pure (ADR-001): the clock is a function input, never read
 * from `Date.now()`. Malformed dates are dropped during normalization (the
 * validator flags them); resolution never throws.
 */

import type { Card } from './models.js';
import type { ScopeValue, VaultConfig } from './config.js';
import { enumValueEntries } from './config.js';
import { isCardDone, placeCard, sortWithinColumn } from './place-card.js';

/** A resolved board scope: the field name and its ordered values. */
export interface ScopeDef {
  /** Frontmatter field whose value places a card in a scope. */
  field: string;
  /** The scope vocabulary, in config order. */
  values: ScopeValue[];
}

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve a vault's board scope, or `null` when it is unscoped.
 *
 * Precedence: an explicit `board.scopeField` (an enum field, its values inline
 * or via a `source` config list) wins; otherwise a non-empty 0.3 `sprints` key
 * is read as a `sprint` scope. A scope with no usable values resolves to
 * `null` — an unscoped board with no scope UI.
 */
export function normalizeScope(config: VaultConfig): ScopeDef | null {
  const explicit = config.board.scopeField;
  let field: string;
  let raw: unknown[];

  if (explicit !== undefined) {
    const def = config.fields[explicit];
    if (def === undefined || def.type !== 'enum') return null;
    field = explicit;
    raw = enumValueEntries(config, def.values, def.source);
  } else if (config.sprints.length > 0) {
    // 0.3 alias: a `sprints` key is read as a `sprint` scope field.
    field = 'sprint';
    raw = config.sprints;
  } else {
    return null;
  }

  const values = normalizeValues(raw);
  return values.length > 0 ? { field, values } : null;
}

/** A card's scope value (`''` when the field is absent or not a string). */
export function cardScopeValue(card: Card, scope: ScopeDef): string {
  const value = card.fields[scope.field];
  return typeof value === 'string' ? value : '';
}

/**
 * The scope to open the board on, given the clock and the cards.
 *
 * Order (ADR-017/ADR-020): a dated value whose window contains `now` wins;
 * else the last value (config order) that still has an unfinished card; else
 * the user's last selection if it names a current value; else the last value,
 * so a scoped board always opens on something. Returns a value name, or `null`
 * when the scope has no values.
 */
export function resolveCurrentScope(
  scope: ScopeDef,
  cards: Card[],
  config: VaultConfig,
  now: number,
  lastSelection?: string,
): string | null {
  const values = scope.values;
  if (values.length === 0) return null;

  for (const value of values) {
    if (isCurrent(value, now)) return value.name;
  }

  for (let i = values.length - 1; i >= 0; i--) {
    const name = values[i].name;
    const hasUnfinished = cards.some(
      (card) => cardScopeValue(card, scope) === name && !isCardDone(card, config),
    );
    if (hasUnfinished) return name;
  }

  if (lastSelection !== undefined && values.some((v) => v.name === lastSelection)) {
    return lastSelection;
  }

  return values[values.length - 1].name;
}

/**
 * Whole days from today to a dated value's end day (inclusive): positive while
 * the scope is live, `0` on the last day, **negative once it has ended**, and
 * `null` when the value has no `ends` date. Signed so callers can tell "last
 * day" from "ended" rather than conflating both as `0`.
 */
export function scopeDaysLeft(value: ScopeValue, now: number): number | null {
  if (value.ends === undefined) return null;
  const end = dateMs(value.ends);
  if (end === null) return null;
  const nowMidnight = Math.floor(now / DAY_MS) * DAY_MS;
  return Math.round((end - nowMidnight) / DAY_MS);
}

/**
 * The backlog (ADR-018/ADR-020): cards with an **empty scope value** that are
 * **not done** and **not hidden** — work that is unscheduled but still live,
 * regardless of which column its status maps to. Ranked by the board's
 * `sortWithinColumn` (priority then id by default). Defined only for scoped
 * vaults, so the caller passes a resolved {@link ScopeDef}.
 */
export function backlogCards(cards: Card[], config: VaultConfig, scope: ScopeDef): Card[] {
  const lastColumn = config.board.columns[config.board.columns.length - 1];
  const live = cards.filter((card) => {
    if (cardScopeValue(card, scope) !== '') return false;
    // One placement per card: keep it if it's on the board (not a hidden
    // Deferred/Dropped state) and not in the last column — the same
    // "last column = done" rule as isCardDone (ADR-003).
    const column = placeCard(card, config).column;
    return column !== null && column !== lastColumn;
  });
  return sortWithinColumn(live, config);
}

// ── internals ──────────────────────────────────────────────────────────────

/** Normalize raw entries to {@link ScopeValue}s, dropping nameless/malformed ones. */
function normalizeValues(raw: unknown[]): ScopeValue[] {
  const out: ScopeValue[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      if (entry !== '') out.push({ name: entry });
      continue;
    }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    if (typeof obj['name'] !== 'string' || obj['name'] === '') continue;
    const value: ScopeValue = { name: obj['name'] };
    if (typeof obj['starts'] === 'string' && isValidIsoDate(obj['starts'])) value.starts = obj['starts'];
    if (typeof obj['ends'] === 'string' && isValidIsoDate(obj['ends'])) value.ends = obj['ends'];
    out.push(value);
  }
  return out;
}

/** True when `now` falls within a value's `[starts, ends]` window (ends inclusive). */
function isCurrent(value: ScopeValue, now: number): boolean {
  if (value.starts === undefined && value.ends === undefined) return false;
  const start = value.starts !== undefined ? dateMs(value.starts) : -Infinity;
  const endDay = value.ends !== undefined ? dateMs(value.ends) : null;
  if (start === null) return false;
  const end = value.ends !== undefined ? (endDay === null ? null : endDay + DAY_MS) : Infinity;
  if (end === null) return false;
  return now >= start && now < end;
}

/** True for a real ISO `YYYY-MM-DD` calendar date (rejects e.g. `2026-13-99`). */
function isValidIsoDate(s: string): boolean {
  return ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** Parse an ISO `YYYY-MM-DD` date to UTC-midnight epoch ms, or `null`. */
function dateMs(iso: string): number | null {
  if (!isValidIsoDate(iso)) return null;
  return Date.parse(`${iso}T00:00:00Z`);
}
