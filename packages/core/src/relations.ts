/**
 * Pure parent/child and dependent relation lookups over the vault model
 * (F-021-S-01).
 *
 * The card page and side peek (F-021) and the board's container progress (F-022)
 * read a card's relations from here, so those surfaces share one source instead
 * of re-deriving parent/child links view-side. Pure: the model (and an already
 * built dependency edge set) in, cards out — unresolved ids are skipped, never
 * thrown (ADR-001).
 */

import type { VaultConfig } from './config.js';
import type { DependencyEdge } from './edges.js';
import type { Card, VaultModel } from './models.js';
import { isCardDone } from './place-card.js';

/** The conventional single-id field naming a card's container parent. */
const PARENT_FIELD = 'parent';

/**
 * The cards whose `parent` resolves to `id`, in card-id order.
 *
 * A structural reverse lookup: every card whose `parent` field is the string
 * `id`. A missing, non-string, or dangling `parent` simply doesn't match — an
 * unresolved parent is skipped, never thrown (ADR-001). `id` need not itself be
 * a card; the result is empty when nothing points at it. Only direct children
 * are returned, not descendants further down a chain.
 */
export function childrenOf(model: VaultModel, id: string): Card[] {
  return Object.keys(model.cards)
    .filter((cardId) => model.cards[cardId].fields[PARENT_FIELD] === id)
    .sort()
    .map((cardId) => model.cards[cardId]);
}

/**
 * The cards that depend on `id` — the reverse of `dependsOn` — in card-id order.
 *
 * Reuses the already-resolved dependency edge set (`buildEdges` / `deriveBlocks`),
 * never re-scanning the model for `dependsOn` and never storing a reverse field
 * (the relation lives in one direction — F-012-S-01). An edge whose `from` no
 * longer resolves to a card is skipped, not thrown (ADR-001). Edges from
 * `buildEdges` are already in `from`-id order, so the result is deterministic.
 */
export function dependentsOf(model: VaultModel, edges: DependencyEdge[], id: string): Card[] {
  return edges
    .filter((edge) => edge.to === id)
    .map((edge) => model.cards[edge.from])
    .filter((card): card is Card => card !== undefined);
}

/** A children-progress rollup: how many of a card's children are done. */
export interface ChildrenProgress {
  /** Children whose status maps to the last board column (see {@link isCardDone}). */
  done: number;
  /** Total children — every card whose `parent` is this id. */
  total: number;
}

/**
 * Roll up a card's direct children into an n-done / m-total progress summary,
 * with "done" meaning the **last** board column via core's column mapping
 * ({@link isCardDone}), never a hardcoded state name (ADR-003) — so it reads
 * correctly for any vault's vocabulary. Every child counts toward `total`,
 * including ones in a hidden state, so the ratio reflects the whole subtree.
 * The relations summary (F-021-S-02) and F-022's container-progress chip share
 * this one rollup.
 */
export function childrenProgress(
  model: VaultModel,
  config: VaultConfig,
  id: string,
): ChildrenProgress {
  const children = childrenOf(model, id);
  const done = children.filter((child) => isCardDone(child, config)).length;
  return { done, total: children.length };
}
