/**
 * Typed dependency edges between cards (F-012-S-01).
 *
 * Resolves each card's dependency-field ids (a list-of-`id` field from the
 * config registry, `dependsOn` by convention) into a typed edge set. Pure:
 * model + config in, edges + diagnostics out — unresolved ids and cycles are
 * reported in `errors`, never thrown (ADR-001). `blocks` is derived from the
 * edge set, never stored, so the relation lives in exactly one place.
 */

import type { VaultConfig } from './config.js';
import type { VaultModel } from './models.js';

/** One dependency relation: card `from` depends on card `to`. */
export interface DependencyEdge {
  from: string;
  to: string;
}

/** Result of {@link buildEdges}: the edge set plus non-fatal diagnostics. */
export interface BuildEdgesResult {
  edges: DependencyEdge[];
  /** Unresolved ids, malformed values, self-references, and cycle reports. */
  errors: string[];
}

/** The conventional dependency field name when the registry declares none. */
export const DEPENDS_ON_FIELD = 'dependsOn';

/**
 * Resolve every card's dependency ids into edges.
 *
 * The field is read per card from `card.fields[fieldName]`; `fieldName`
 * defaults to the `dependsOn` convention and should be a list-of-`id` field in
 * the config registry (ADR-003) — a registry entry of a different shape is
 * reported, not ignored. Edges are emitted in card-id order so the result is
 * deterministic. Cycles (including self-references) are reported in `errors`
 * with the offending path; the edges themselves are still returned so a view
 * can render and flag them.
 */
export function buildEdges(
  model: VaultModel,
  config: VaultConfig,
  fieldName: string = DEPENDS_ON_FIELD,
): BuildEdgesResult {
  const errors: string[] = [];

  const fieldDef = config.fields[fieldName];
  if (fieldDef !== undefined && (fieldDef.type !== 'id' || fieldDef.list !== true)) {
    errors.push(
      `field ${fieldName}: expected a list-of-id field in the registry (got type '${fieldDef.type}'${fieldDef.list === true ? ', list' : ''})`,
    );
  }

  const edges: DependencyEdge[] = [];
  const ids = Object.keys(model.cards).sort();

  for (const cardId of ids) {
    const card = model.cards[cardId];
    const raw = card.fields[fieldName];
    if (raw === undefined || raw === null) continue;

    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (typeof value !== 'string' || value === '') {
        errors.push(`${cardId}: ${fieldName} entry is not an id (${JSON.stringify(value)})`);
        continue;
      }
      if (model.cards[value] === undefined) {
        errors.push(`${cardId}: ${fieldName} '${value}' does not resolve to a card`);
        continue;
      }
      edges.push({ from: cardId, to: value });
    }
  }

  for (const cycle of findCycles(edges)) {
    errors.push(`dependency cycle: ${cycle.join(' → ')}`);
  }

  return { edges, errors };
}

/**
 * Derived inverse view of an edge set: card id → ids of the cards it blocks
 * (the cards that depend on it). Never persisted (F-012-S-01: store one
 * direction only).
 */
export function deriveBlocks(edges: DependencyEdge[]): Record<string, string[]> {
  const blocks: Record<string, string[]> = {};
  for (const edge of edges) {
    (blocks[edge.to] ??= []).push(edge.from);
  }
  return blocks;
}

/**
 * Find every distinct dependency cycle in the edge set, each reported as a
 * closed id path (`[A, B, A]`). A self-reference is a cycle of length one.
 * Iterative colored DFS in deterministic id order.
 */
function findCycles(edges: DependencyEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }
  for (const list of adjacency.values()) list.sort();

  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const cycles: string[][] = [];

  const visit = (start: string, stack: string[]): void => {
    color.set(start, GRAY);
    stack.push(start);
    for (const next of adjacency.get(start) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        // Back edge: the cycle is the stack slice from `next` onward, closed.
        const at = stack.indexOf(next);
        cycles.push([...stack.slice(at), next]);
      } else if (c === WHITE) {
        visit(next, stack);
      }
    }
    stack.pop();
    color.set(start, BLACK);
  };

  for (const id of [...adjacency.keys()].sort()) {
    if ((color.get(id) ?? WHITE) === WHITE) visit(id, []);
  }

  return cycles;
}
