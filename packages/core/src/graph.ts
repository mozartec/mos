/**
 * Layered DAG layout for the dependency graph (F-012-S-02).
 *
 * Turns the typed edge set (F-012-S-01) into positioned geometry the Graph
 * lens can render directly: each node gets a `rank` (longest-path depth from a
 * root, so prerequisites sit left of dependents) and a stable within-rank
 * `order`. Pure and deterministic — same model in, same layout out; no DOM,
 * no framework, no randomness (ADR-001). Cyclic input never loops or throws:
 * the back-edge is excluded from ranking and flagged `broken` on the edge.
 */

import type { VaultConfig } from './config.js';
import type { VaultModel } from './models.js';
import { buildEdges } from './edges.js';
import { compareIdsByPriority } from './place-card.js';

/** A positioned graph node: rendering needs nothing beyond this. */
export interface GraphNode {
  id: string;
  /** Longest-path depth from a root (a card with no dependencies). */
  rank: number;
  /** Stable position within the rank (priority then id). */
  order: number;
  status: string;
  title: string;
  /**
   * True when the card's status maps to the last board column — the
   * config-driven notion of "done" (ADR-003), precomputed here so
   * {@link readySet} and {@link criticalPath} need no further config.
   */
  done: boolean;
}

/** A directional edge `from` (dependent) → `to` (prerequisite). */
export interface GraphEdge {
  from: string;
  to: string;
  /** True when this edge was dropped from ranking to break a cycle. */
  broken?: boolean;
}

/** Result of {@link buildDependencyGraph}. */
export interface DependencyGraph {
  /** Every card as a positioned node, sorted by rank then order. */
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Diagnostics from edge resolution and cycle breaking — never thrown. */
  errors: string[];
}

/**
 * Compute the layered layout for every card in the model.
 *
 * Ranks satisfy: roots (no dependencies) are rank 0, and a dependent is always
 * a strictly higher rank than each of its prerequisites (over non-broken
 * edges). Disconnected cards are rank-0 nodes. Within a rank, nodes are
 * ordered by the config-driven priority ranking, then id.
 */
export function buildDependencyGraph(model: VaultModel, config: VaultConfig): DependencyGraph {
  const { edges: rawEdges, errors } = buildEdges(model, config);

  // Adjacency: dependent → its prerequisites, in deterministic order.
  const dependencies = new Map<string, string[]>();
  for (const edge of rawEdges) {
    const list = dependencies.get(edge.from) ?? [];
    list.push(edge.to);
    dependencies.set(edge.from, list);
  }
  for (const list of dependencies.values()) list.sort();

  // Colored DFS to find back-edges; dropping them breaks every cycle.
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const brokenKeys = new Set<string>();
  const edgeKey = (from: string, to: string): string => `${from} ${to}`;

  const breakCycles = (id: string): void => {
    color.set(id, GRAY);
    for (const dep of dependencies.get(id) ?? []) {
      const c = color.get(dep) ?? WHITE;
      if (c === GRAY) brokenKeys.add(edgeKey(id, dep));
      else if (c === WHITE) breakCycles(dep);
    }
    color.set(id, BLACK);
  };

  const allIds = Object.keys(model.cards).sort();
  for (const id of allIds) {
    if ((color.get(id) ?? WHITE) === WHITE) breakCycles(id);
  }

  // Longest-path rank over the now-acyclic dependency edges (memoized DFS).
  const ranks = new Map<string, number>();
  const rankOf = (id: string): number => {
    const memo = ranks.get(id);
    if (memo !== undefined) return memo;
    let rank = 0;
    for (const dep of dependencies.get(id) ?? []) {
      if (brokenKeys.has(edgeKey(id, dep))) continue;
      if (model.cards[dep] === undefined) continue;
      rank = Math.max(rank, rankOf(dep) + 1);
    }
    ranks.set(id, rank);
    return rank;
  };
  for (const id of allIds) rankOf(id);

  // Stable order within each rank: priority rank (config-driven) then id.
  const byPriority = compareIdsByPriority(model, config);
  const byRank = new Map<number, string[]>();
  for (const id of allIds) {
    const list = byRank.get(ranks.get(id) ?? 0) ?? [];
    list.push(id);
    byRank.set(ranks.get(id) ?? 0, list);
  }

  const nodes: GraphNode[] = [];
  for (const rank of [...byRank.keys()].sort((a, b) => a - b)) {
    const ids = byRank.get(rank) ?? [];
    ids.sort(byPriority);
    ids.forEach((id, order) => {
      const card = model.cards[id];
      const lastColumn = config.board.columns[config.board.columns.length - 1];
      const column = config.types[card.type]?.states[card.status];
      nodes.push({
        id,
        rank,
        order,
        status: card.status,
        title: card.title,
        done: column !== undefined && column !== null && column === lastColumn,
      });
    });
  }

  const edges: GraphEdge[] = rawEdges.map((edge) =>
    brokenKeys.has(edgeKey(edge.from, edge.to)) ? { ...edge, broken: true } : { ...edge },
  );

  return { nodes, edges, errors };
}

/**
 * The ready set (F-012-S-04): ids of cards that can start right now — not done
 * themselves, with every dependency (over non-broken edges) done. Plain data,
 * UI-free, so agents/MCP can consume it as-is. Sorted for determinism.
 */
export function readySet(graph: DependencyGraph): string[] {
  const doneById = new Map(graph.nodes.map((n) => [n.id, n.done]));
  const blockedIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.broken === true) continue;
    if (doneById.get(edge.to) !== true) blockedIds.add(edge.from);
  }
  return graph.nodes
    .filter((n) => !n.done && !blockedIds.has(n.id))
    .map((n) => n.id)
    .sort();
}

/**
 * The critical path (F-012-S-04): the longest prerequisite chain by node
 * count, over non-broken edges, returned root-first (prerequisite →
 * dependent). Ties break deterministically toward the smallest id. Empty
 * graph → empty path.
 */
export function criticalPath(graph: DependencyGraph): string[] {
  // Dependencies per node, smallest id first for deterministic tie-breaks.
  const dependencies = new Map<string, string[]>();
  for (const node of graph.nodes) dependencies.set(node.id, []);
  for (const edge of graph.edges) {
    if (edge.broken === true) continue;
    if (!dependencies.has(edge.from) || !dependencies.has(edge.to)) continue;
    dependencies.get(edge.from)?.push(edge.to);
  }
  for (const list of dependencies.values()) list.sort();

  // Longest chain ending at each node (memoized; acyclic after breaking).
  const length = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const chainTo = (id: string): number => {
    const memo = length.get(id);
    if (memo !== undefined) return memo;
    let best = 1;
    let bestPrev: string | null = null;
    for (const dep of dependencies.get(id) ?? []) {
      const candidate = chainTo(dep) + 1;
      if (candidate > best) {
        best = candidate;
        bestPrev = dep;
      }
    }
    length.set(id, best);
    previous.set(id, bestPrev);
    return best;
  };

  let endId: string | null = null;
  let bestLength = 0;
  for (const id of [...dependencies.keys()].sort()) {
    const len = chainTo(id);
    if (len > bestLength) {
      bestLength = len;
      endId = id;
    }
  }

  const path: string[] = [];
  for (let id = endId; id !== null; id = previous.get(id) ?? null) {
    path.unshift(id);
  }
  return path;
}
