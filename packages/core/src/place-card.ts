/**
 * Pure helpers for placing cards on the board based on type state-to-column mapping.
 *
 * Given a card and the vault config, compute which column it belongs in and
 * whether it's blocked. States mapped to `null` are hidden; multiple states
 * may share a column. `Blocked` status gets a badge but stays in `In Progress`.
 *
 * Sorting within a column uses priority rank (P0, P1, P2, P3) then card id.
 */

import type { Card, VaultConfig } from './index.js';

/**
 * Result of placing a card on the board: the column it belongs in (or `null`
 * to hide it) and whether it's blocked.
 */
export interface CardPlacement {
  /** Column name from `config.board.columns`, or `null` if the card is hidden. */
  column: string | null;
  /** True if the card's status is `Blocked`. */
  blocked: boolean;
}

/**
 * Compute where a card should be placed on the board based on its type and status.
 *
 * Looks up the card's type in the config and resolves `states[card.status]` to
 * determine the column. Returns `null` for a column if the status maps to `null`
 * (e.g., Deferred or Dropped cards are hidden).
 *
 * @param card The card to place.
 * @param config The vault config, which defines type→state→column mappings.
 * @returns Placement info: `column` (string or `null`) and `blocked` flag.
 * @throws Error if the card's type or status is unknown and unrecoverable.
 */
export function placeCard(card: Card, config: VaultConfig): CardPlacement {
  const typeDef = config.types[card.type];
  if (!typeDef) {
    throw new Error(`Unknown card type '${card.type}' (card ${card.id})`);
  }

  const column = typeDef.states[card.status];
  if (column === undefined) {
    throw new Error(
      `Unknown status '${card.status}' for type '${card.type}' (card ${card.id})`,
    );
  }

  return {
    column,
    blocked: card.status === 'Blocked',
  };
}

/**
 * Priority field rank order fallback when not configured in fields.
 * This is the default priority ranking per VAULT_SPEC.
 */
const DEFAULT_PRIORITY_RANK: readonly string[] = ['P0', 'P1', 'P2', 'P3'];

/**
 * Derive priority ranking from config, or use defaults.
 *
 * Per ADR-003 (config-driven), priority rank comes from
 * `config.fields.priority?.values` if declared (enum field type).
 * Falls back to DEFAULT_PRIORITY_RANK when absent or not an enum.
 */
function getPriorityRank(config: VaultConfig): readonly string[] {
  const priorityField = config.fields['priority'];
  if (priorityField?.type === 'enum' && priorityField?.values?.length) {
    return priorityField.values;
  }
  return DEFAULT_PRIORITY_RANK;
}

/**
 * Sort cards by the config's `board.sortWithinColumn` ranking.
 *
 * The default ranking is `['priority', 'id']`: sorts first by priority
 * (according to rank order), then by card id (lexicographic).
 * Priority rank is config-driven; see {@link getPriorityRank}.
 *
 * @param cards The cards to sort.
 * @param config The vault config, which defines the sort order.
 * @returns A new sorted array; the input array is not mutated.
 */
export function sortWithinColumn(cards: Card[], config: VaultConfig): Card[] {
  const result = [...cards];

  const sortFields = config.board.sortWithinColumn;
  if (sortFields.length === 0) {
    return result;
  }

  const priorityRank = getPriorityRank(config);
  const rankMap = new Map(priorityRank.map((rank, index) => [rank, index]));

  result.sort((a, b) => {
    for (const field of sortFields) {
      let cmp = 0;

      if (field === 'priority') {
        const aRank = rankMap.get(a.priority ?? '') ?? priorityRank.length;
        const bRank = rankMap.get(b.priority ?? '') ?? priorityRank.length;
        cmp = aRank - bRank;
      } else if (field === 'id') {
        cmp = (a.id ?? '').localeCompare(b.id ?? '');
      }
      // Other sort-field names are intentionally no-ops for MVP.

      if (cmp !== 0) {
        return cmp;
      }
    }

    return 0;
  });

  return result;
}
