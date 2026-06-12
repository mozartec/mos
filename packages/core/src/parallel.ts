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
import { buildDependencyGraph, readySet, type DependencyGraph } from './graph.js';
import { compareIdsByPriority } from './place-card.js';

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
  /** Entries that are not names at all (non-string or empty), as declared. */
  malformed: unknown[];
}

/**
 * Resolve one card's `touches` declaration against the config's `areas` map.
 * A missing field resolves to all-empty; a scalar string is treated as a
 * one-entry list. The distinction between "missing" and "declared empty"
 * matters only to {@link parallelBatch}.
 */
export function resolveTouches(
  card: Card,
  config: VaultConfig,
  fieldName: string = TOUCHES_FIELD,
): ResolvedTouches {
  const areas: string[] = [];
  const globs: string[] = [];
  const unknown: string[] = [];

  const declared = declaredTouches(card, fieldName);
  for (const name of declared?.names ?? []) {
    const areaGlobs = Object.hasOwn(config.areas, name) ? config.areas[name] : undefined;
    if (Array.isArray(areaGlobs)) {
      areas.push(name);
      for (const glob of areaGlobs) {
        if (typeof glob === 'string' && !globs.includes(glob)) globs.push(glob);
      }
    } else {
      unknown.push(name);
    }
  }

  return { areas, globs, unknown, malformed: declared?.malformed ?? [] };
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
   * Ready cards whose surface is unknown: no `touches` declaration, or a
   * declaration with malformed (non-string) entries — parallel safety can't
   * be claimed for either. An explicit empty list is a declaration ("touches
   * nothing") and batches; an absent field does not.
   */
  undeclared: string[];
  /**
   * Diagnostics: dependency resolution (unresolved ids — which do NOT block
   * readiness; the edge is dropped and only reported here — and cycles) plus
   * malformed `touches` entries. Batch consumers must surface these.
   */
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
 *
 * Pass `graph` when the caller already built the dependency graph (a lens
 * rendering it, for example) so it isn't recomputed; by default one is built
 * from the model.
 */
export function parallelBatch(
  model: VaultModel,
  config: VaultConfig,
  fieldName: string = TOUCHES_FIELD,
  graph: DependencyGraph = buildDependencyGraph(model, config),
): ParallelBatchResult {
  const errors = [...graph.errors];
  // readySet returns a fresh array, safe to sort in place.
  const candidates = readySet(graph).sort(compareIdsByPriority(model, config));

  if (Object.keys(config.areas).length === 0) {
    return { batch: candidates, conflicts: [], undeclared: [], errors };
  }

  const batch: string[] = [];
  const conflicts: BatchConflict[] = [];
  const undeclared: string[] = [];
  const claimed = new Map<string, string[]>(); // batch member → its area names

  for (const id of candidates) {
    const declared = declaredTouches(model.cards[id], fieldName);
    for (const entry of declared?.malformed ?? []) {
      errors.push(`${id}: ${fieldName} entry is not an area name (${JSON.stringify(entry)})`);
    }
    if (declared === undefined || declared.malformed.length > 0) {
      // No declaration, or one we can't fully read — the surface is unknown.
      undeclared.push(id);
      continue;
    }
    let conflicted = false;
    for (const [member, memberNames] of claimed) {
      const shared = declared.names.filter((n) => memberNames.includes(n));
      if (shared.length > 0) {
        conflicts.push({ excluded: id, with: member, areas: shared });
        conflicted = true;
      }
    }
    if (!conflicted) {
      batch.push(id);
      claimed.set(id, declared.names);
    }
  }

  return { batch, conflicts, undeclared, errors };
}

/**
 * A card's raw `touches` declaration: its string names, deduped, plus any
 * entries that are not names at all. `undefined` when the field is absent
 * (or the card is), which is distinct from a declared-empty list.
 */
function declaredTouches(
  card: Card | undefined,
  fieldName: string,
): { names: string[]; malformed: unknown[] } | undefined {
  const raw = card?.fields[fieldName];
  if (raw === undefined || raw === null) return undefined;
  const values = Array.isArray(raw) ? raw : [raw];
  const names: string[] = [];
  const malformed: unknown[] = [];
  for (const value of values) {
    if (typeof value === 'string' && value !== '') {
      if (!names.includes(value)) names.push(value);
    } else {
      malformed.push(value);
    }
  }
  return { names, malformed };
}
