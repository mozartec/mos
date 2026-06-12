/**
 * Areas & touches — declared file surfaces (F-024, ADR-021).
 *
 * `dependsOn` answers "what is unblocked"; `touches` answers "what won't
 * collide". A card names the vault-defined areas (config `areas`, VAULT_SPEC
 * §5c) it expects to modify, and {@link parallelBatch} returns the ready cards
 * whose declared surfaces are pairwise disjoint — the set that is safe to work
 * in parallel. Pure: model + config in, plain data out — no git, no
 * filesystem (ADR-001). Area names and globs are vault-defined; nothing here
 * assumes any repo layout (ADR-003).
 */

import type { VaultConfig } from './config.js';
import type { Card, VaultModel } from './models.js';
import { buildDependencyGraph, readySet } from './graph.js';
import { getPriorityRank } from './place-card.js';

/** The conventional surface field name when the registry declares none. */
export const TOUCHES_FIELD = 'touches';

/** A card's declared surface resolved against the config's `areas` map. */
export interface ResolvedTouches {
  /** Declared names the config defines, in declaration order. */
  areas: string[];
  /** The globs those areas map to, deduped, in area order. */
  globs: string[];
  /** Declared names that match no configured area (validator material). */
  unknown: string[];
}

/**
 * Resolve one card's `touches` declaration against the config's `areas` map.
 * A missing or non-list value resolves to all-empty; the distinction between
 * "missing" and "declared empty" matters only to {@link parallelBatch}.
 */
export function resolveTouches(
  card: Card,
  config: VaultConfig,
  fieldName: string = TOUCHES_FIELD,
): ResolvedTouches {
  const areas: string[] = [];
  const globs: string[] = [];
  const unknown: string[] = [];

  for (const name of declaredTouches(card, fieldName) ?? []) {
    const areaGlobs = config.areas[name];
    if (Array.isArray(areaGlobs)) {
      areas.push(name);
      for (const glob of areaGlobs) {
        if (typeof glob === 'string' && !globs.includes(glob)) globs.push(glob);
      }
    } else {
      unknown.push(name);
    }
  }

  return { areas, globs, unknown };
}

/** One excluded pairing: `excluded` overlaps batch member `with` on `areas`. */
export interface BatchConflict {
  /** The card left out of the batch. */
  excluded: string;
  /** The already-batched card it collides with. */
  with: string;
  /** The area names the two declarations share. */
  areas: string[];
}

/** Result of {@link parallelBatch}: the batch plus everything it set aside. */
export interface ParallelBatchResult {
  /**
   * Ready cards (every dependency done) whose `touches` are pairwise
   * disjoint, in pick order (priority rank, then id).
   */
  batch: string[];
  /** Ready cards excluded for overlapping a batch member, one entry per pair. */
  conflicts: BatchConflict[];
  /**
   * Ready cards with no `touches` declaration — their surface is unknown, so
   * parallel safety can't be claimed. An explicit empty list is a declaration
   * ("touches nothing") and batches; an absent field does not.
   */
  undeclared: string[];
  /** Diagnostics from dependency resolution (unresolved ids, cycles). */
  errors: string[];
}

/**
 * Compute the parallel batch (ADR-021): ready cards — not done, dependencies
 * done — whose declared `touches` are pairwise disjoint, with the conflicting
 * pairs it excluded.
 *
 * Disjointness is over area *names*: declarations are the plan's truth, and
 * whether two areas' globs overlap is the vault author's contract when naming
 * them (unknown names still collide by name; the validator flags them).
 * Selection is greedy and deterministic — candidates are visited by the
 * config-driven priority rank, then id, so higher-priority work claims its
 * surface first. A vault that configures no `areas` plans no surfaces: the
 * batch is simply the ready set, nothing is excluded or undeclared.
 */
export function parallelBatch(
  model: VaultModel,
  config: VaultConfig,
  fieldName: string = TOUCHES_FIELD,
): ParallelBatchResult {
  const graph = buildDependencyGraph(model, config);
  const ready = readySet(graph);

  const priorityRank = getPriorityRank(config);
  const priorityIndex = new Map(priorityRank.map((p, i) => [p, i]));
  const candidates = [...ready].sort((a, b) => {
    const pa = priorityIndex.get(model.cards[a]?.priority ?? '') ?? priorityRank.length;
    const pb = priorityIndex.get(model.cards[b]?.priority ?? '') ?? priorityRank.length;
    return pa - pb || a.localeCompare(b);
  });

  if (Object.keys(config.areas).length === 0) {
    return { batch: candidates, conflicts: [], undeclared: [], errors: graph.errors };
  }

  const batch: string[] = [];
  const conflicts: BatchConflict[] = [];
  const undeclared: string[] = [];
  const claimed = new Map<string, string[]>(); // batch member → its area names

  for (const id of candidates) {
    const names = declaredTouches(model.cards[id], fieldName);
    if (names === undefined) {
      undeclared.push(id);
      continue;
    }
    const overlaps: BatchConflict[] = [];
    for (const [member, memberNames] of claimed) {
      const shared = names.filter((n) => memberNames.includes(n));
      if (shared.length > 0) overlaps.push({ excluded: id, with: member, areas: shared });
    }
    if (overlaps.length > 0) {
      conflicts.push(...overlaps);
    } else {
      batch.push(id);
      claimed.set(id, names);
    }
  }

  return { batch, conflicts, undeclared, errors: graph.errors };
}

/**
 * A card's raw `touches` declaration as a string list, deduped; `undefined`
 * when the field is absent (or the card is), which is distinct from a
 * declared-empty list.
 */
function declaredTouches(card: Card | undefined, fieldName: string): string[] | undefined {
  const raw = card?.fields[fieldName];
  if (raw === undefined || raw === null) return undefined;
  const values = Array.isArray(raw) ? raw : [raw];
  const names: string[] = [];
  for (const value of values) {
    if (typeof value === 'string' && value !== '' && !names.includes(value)) names.push(value);
  }
  return names;
}
