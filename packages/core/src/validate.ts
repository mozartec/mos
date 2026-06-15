/**
 * The vault validator (T-017), graduated from `scripts/validate-vault.mjs`.
 *
 * The standalone script used to inline its own frontmatter parser and a
 * reimplemented board placement; those duplicated what core already does
 * (`parseFile`, `buildModel`, `placeCard`). This module is the validation
 * **rules**, lifted onto core's parser/config/placement and kept **pure**
 * (ADR-001): it takes an already-built {@link BuildModelResult} (the caller ran
 * `parseFile` + `buildModel`), the loaded {@link VaultConfig}, and the vault's
 * relative file paths — needed only by the area-glob overlap check — and returns
 * diagnostics. All file reading, vault discovery, and report printing stay in
 * the I/O shell: the script today, the `mos validate` CLI next (F-029).
 *
 * It owns the type/area/scope **shape** checks rather than delegating them to
 * `loadConfig`, because their diagnostics are user-facing and granular
 * (T-012's overlap, T-016's per-glob naming); `loadConfig` is used by the shell
 * only to normalize the config. The one rule core didn't have before is
 * spec-version awareness (§0): a warning when a vault targets a newer format
 * than this build understands.
 */

import type { VaultConfig } from './config.js';
import { enumValueEntries } from './config.js';
import type { BuildModelResult, Card } from './models.js';
import { globToRegExp, toPosixPath } from './path-glob.js';
import { inFlightColumn, placeCard } from './place-card.js';

/**
 * The newest spec version (VAULT_SPEC §0) this validator understands. The format
 * evolves purely additively, so any equal-or-older vault validates unchanged and
 * only a vault targeting a *newer* version draws a non-fatal warning — some of
 * its keys may carry rules this build can't yet check. Bump it when the app's
 * support claim moves to a new format version (docs/11-RELEASING.md).
 */
export const SUPPORTED_SPEC_VERSION = '0.4';

/** Diagnostics from {@link validateVault}: blocking errors and non-fatal warnings. */
export interface ValidateVaultResult {
  /** Problems that make the vault invalid (the shell exits non-zero). */
  errors: string[];
  /** Advisory smells that don't fail the vault (overlap, ordering, spec drift). */
  warnings: string[];
}

/** Timestamp fields are UTC ISO 8601 with the `Z` designator, never an offset (ADR-010). */
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
/** A bare `YYYY-MM-DD` calendar date, used by scope `starts`/`ends` (§5d). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate one vault against its config. Pure: parsed input + config in, plain
 * diagnostics out — no I/O (ADR-001).
 *
 * @param build  The output of {@link buildModel} over the vault's parsed card
 *   files: the model plus the identity diagnostics (duplicate/idless cards).
 * @param config The loaded, normalized {@link VaultConfig} (caller ran `loadConfig`).
 * @param paths  Every vault-relative path, POSIX-separated — the file list the
 *   area-glob overlap check matches globs against (it flags only *demonstrable*
 *   overlap: a real file two areas both match).
 */
export function validateVault(
  build: BuildModelResult,
  config: VaultConfig,
  paths: string[],
): ValidateVaultResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // buildModel already identified cards and flagged duplicate / idless ones; a
  // "not a card" diagnostic is just a board-scope file that isn't one (the old
  // script skipped those silently), so it is surfaced as neither error nor card.
  for (const diagnostic of build.diagnostics) {
    if (!diagnostic.includes('not a card')) errors.push(diagnostic);
  }

  checkSpecVersion(config.specVersion, warnings);
  validateTypes(config, errors);
  validateScope(config, errors, warnings);
  validateAreaOverlap(config.areas, paths, warnings);
  validateAreas(config.areas, errors);
  validateCards(build.model.cards, config, errors, warnings);
  validateInFlightOverlap(build.model.cards, config, warnings);

  return { errors, warnings };
}

// ── spec version (§0) ────────────────────────────────────────────────────────

/**
 * Warn when the vault targets a spec version newer than {@link
 * SUPPORTED_SPEC_VERSION}. Never an error: the format is forward-additive, so an
 * older app validates a newer vault's known keys correctly and merely can't
 * vouch for keys it has never heard of. An absent or unparseable version is
 * silent — version is advisory, never a gate.
 */
function checkSpecVersion(version: string, warnings: string[]): void {
  const target = parseVersion(version);
  if (target === null) return;
  const supported = parseVersion(SUPPORTED_SPEC_VERSION);
  if (supported !== null && compareVersions(target, supported) > 0) {
    warnings.push(
      `specVersion ${version} is newer than the supported ${SUPPORTED_SPEC_VERSION} — ` +
        `this build of mos may not enforce every rule the format adds (upgrade to validate fully)`,
    );
  }
}

/** A dotted numeric version to a number tuple, or `null` if absent/non-numeric. */
function parseVersion(version: string): number[] | null {
  if (typeof version !== 'string' || version === '') return null;
  const parts = version.split('.').map((part) => Number(part));
  if (parts.some((n) => !Number.isInteger(n) || n < 0)) return null;
  return parts;
}

/** Element-wise compare of version tuples, missing components treated as 0. */
function compareVersions(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ── config shape: types & scope ──────────────────────────────────────────────

/**
 * Parent nesting ≤ 1 and every state maps to a real column or `null` (ADR-003).
 * A type with no usable `states` map can't place its cards — and would crash
 * placement — so it is reported, not thrown on. Reads the types defensively (as
 * unknown), mirroring loadConfig, since a malformed config may carry non-objects.
 */
function validateTypes(config: VaultConfig, errors: string[]): void {
  const columns = config.board.columns;
  const types = config.types as Record<string, unknown>;
  for (const [typeName, typeRaw] of Object.entries(types)) {
    const type = isObject(typeRaw) ? typeRaw : {};

    const parent = type['parent'];
    if (parent != null) {
      const parentDef = typeof parent === 'string' ? types[parent] : undefined;
      if (!isObject(parentDef)) {
        errors.push(`type ${typeName}: parent type '${String(parent)}' is not defined`);
      } else if (parentDef['parent'] != null) {
        errors.push(
          `type ${typeName}: parent '${String(parent)}' itself has a parent (nesting > 1)`,
        );
      }
    }

    const states = type['states'];
    if (!isObject(states)) {
      errors.push(`type ${typeName}: no states defined`);
      continue;
    }
    for (const [state, column] of Object.entries(states)) {
      if (column != null && (typeof column !== 'string' || !columns.includes(column))) {
        errors.push(
          `type ${typeName}: state '${state}' maps to unknown column '${String(column)}'`,
        );
      }
    }
  }
}

/**
 * Board scope (§5d, ADR-020): the `board.scopeField` must name a registered
 * enum, dated values must carry valid, non-inverted ISO dates (errors), and
 * overlapping windows are flagged (a warning). A scope-less vault is left clean.
 */
function validateScope(config: VaultConfig, errors: string[], warnings: string[]): void {
  let raw: unknown[];
  const field = config.board.scopeField;
  if (field !== undefined) {
    const def = config.fields[field];
    if (def === undefined) {
      errors.push(`board.scopeField: '${field}' is not a registered field`);
      return;
    }
    if (def.type !== 'enum') {
      errors.push(`board.scopeField: field '${field}' must be an enum`);
      return;
    }
    raw = enumValueEntries(config, def.values, def.source);
  } else if (config.sprints.length > 0) {
    raw = config.sprints; // 0.3 alias read as a scope (§5d)
  } else {
    return; // unscoped
  }

  const dated: { name: string; starts: number; ends: number }[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') continue; // dateless value, fine
    if (!isObject(entry)) {
      errors.push(
        `board scope: value ${JSON.stringify(entry)} must be a string or { name, starts?, ends? }`,
      );
      continue;
    }
    const name = entry['name'];
    if (typeof name !== 'string' || name === '') {
      errors.push('board scope: a value is missing a name');
      continue;
    }
    for (const key of ['starts', 'ends'] as const) {
      if (entry[key] != null && !isValidIsoDate(entry[key])) {
        errors.push(
          `board scope '${name}': ${key} '${String(entry[key])}' is not a valid ISO date (YYYY-MM-DD)`,
        );
      }
    }
    const starts = isValidIsoDate(entry['starts']) ? dateMs(entry['starts']) : null;
    const ends = isValidIsoDate(entry['ends']) ? dateMs(entry['ends']) : null;
    if (starts != null && ends != null) {
      if (starts > ends) {
        errors.push(
          `board scope '${name}': starts '${String(entry['starts'])}' is after ends '${String(entry['ends'])}'`,
        );
      } else {
        dated.push({ name, starts, ends });
      }
    }
  }

  dated.sort((a, b) => a.starts - b.starts);
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      if (dated[i].starts <= dated[j].ends && dated[j].starts <= dated[i].ends) {
        warnings.push(
          `board scope '${dated[i].name}' and '${dated[j].name}' have overlapping dates`,
        );
      }
    }
  }
}

// ── areas (§5c) ──────────────────────────────────────────────────────────────

/**
 * Area glob overlap (§5c, T-012): two differently-named areas whose globs both
 * match a real file in the vault defeat the point — `touches` math compares
 * areas by name. Flags only *demonstrable* overlap (a file the `paths` list
 * actually contains, matched by ≥2 areas), one warning per pair with the
 * lexicographically smallest shared path, so a many-file overlap is one line.
 * A warning, never an error; granularity ("is this area too coarse?") is a
 * planning call and stays out.
 */
function validateAreaOverlap(
  areas: Record<string, unknown>,
  paths: string[],
  warnings: string[],
): void {
  if (!isObject(areas)) return;
  const compiled = Object.entries(areas).map(([name, globs]) => ({
    name,
    matchers: (Array.isArray(globs) ? globs : [globs])
      .filter((glob): glob is string => typeof glob === 'string')
      .map(globToRegExp),
  }));
  if (compiled.length < 2) return; // 0 or 1 area can't overlap

  // Per overlapping pair (smaller name first) keep the smallest matching path,
  // so the output is one deterministic line regardless of walk order.
  const samples = new Map<string, Map<string, string>>();
  for (const rel of paths.map(toPosixPath)) {
    const hit = compiled.filter((a) => a.matchers.some((re) => re.test(rel))).map((a) => a.name);
    if (hit.length < 2) continue;
    hit.sort();
    for (let i = 0; i < hit.length; i++) {
      for (let j = i + 1; j < hit.length; j++) {
        let byB = samples.get(hit[i]);
        if (byB === undefined) samples.set(hit[i], (byB = new Map()));
        const prev = byB.get(hit[j]);
        if (prev === undefined || rel < prev) byB.set(hit[j], rel);
      }
    }
  }
  for (const a of [...samples.keys()].sort()) {
    for (const b of [...samples.get(a)!.keys()].sort()) {
      warnings.push(
        `areas '${a}' and '${b}' have overlapping globs (both match '${samples.get(a)!.get(b)!}')`,
      );
    }
  }
}

/**
 * Area definition shape (§5c, T-016): each `areas` entry maps a name to a list
 * of glob strings. A malformed area would otherwise compile to fewer (or zero)
 * regexes and vanish silently from overlap detection; this names the offender —
 * a non-array value, and each non-string glob entry — as an error. Shape only;
 * it does not validate glob syntax beyond "is a string". Runs independently of
 * the overlap check (which needs ≥2 areas), so a single malformed area is caught.
 */
function validateAreas(areas: Record<string, unknown>, errors: string[]): void {
  if (!isObject(areas)) return;
  for (const [name, globs] of Object.entries(areas)) {
    if (!Array.isArray(globs)) {
      errors.push(
        `area '${name}': definition must be a list of glob strings, got ${JSON.stringify(globs)}`,
      );
      continue;
    }
    for (const glob of globs) {
      if (typeof glob !== 'string') {
        errors.push(`area '${name}': glob ${JSON.stringify(glob)} is not a string`);
      }
    }
  }
}

// ── per-card checks ──────────────────────────────────────────────────────────

/**
 * Every card-level rule the board depends on: status allowed for its type,
 * parent nesting/resolution, UTC timestamps (ADR-010), id-list resolution (e.g.
 * `dependsOn`), list-enum membership (e.g. `touches` → `areas`, F-024), the §5c
 * `touches` fallback, and frontmatter key order (F-013, a warning).
 */
function validateCards(
  cards: Record<string, Card>,
  config: VaultConfig,
  errors: string[],
  warnings: string[],
): void {
  const timestampFields = [
    config.meta.timestamps.createdField,
    config.meta.timestamps.updatedField,
  ];
  const listEnumAllowed = buildListEnumAllowed(config);
  const fieldOrder = config.fieldOrder;

  for (const card of Object.values(cards)) {
    const typeDef = config.types[card.type];
    // Guard the states map: a malformed type with none is already reported by
    // validateTypes, and `in undefined` would throw (validateTypes/placeCard fix).
    const typeStates = isObject(typeDef?.states) ? typeDef.states : undefined;

    if (typeStates !== undefined && !(card.status in typeStates)) {
      errors.push(`${card.id}: status '${card.status}' not allowed for type '${card.type}'`);
    }

    const parent = card.fields['parent'];
    if (parent != null) {
      if (typeof parent !== 'string') {
        errors.push(`${card.id}: parent is not a single id`);
      } else if (typeDef === undefined || typeDef.parent == null) {
        errors.push(`${card.id}: type '${card.type}' may not have a parent`);
      } else if (cards[parent] === undefined) {
        errors.push(`${card.id}: parent '${parent}' not found`);
      } else if (cards[parent].type !== typeDef.parent) {
        errors.push(
          `${card.id}: parent '${parent}' is type '${cards[parent].type}', expected '${typeDef.parent}'`,
        );
      }
    }

    for (const field of timestampFields) {
      const value = card.fields[field];
      if (value == null || value === '') continue; // timestamps are optional
      if (typeof value !== 'string' || !UTC_ISO.test(value) || Number.isNaN(Date.parse(value))) {
        errors.push(
          `${card.id}: ${field} '${String(value)}' is not UTC ISO 8601 (expected e.g. 2026-06-08T09:00:00Z)`,
        );
      }
    }

    // Every id in a list-of-id field (e.g. dependsOn) must resolve to a card.
    for (const [fieldName, def] of Object.entries(config.fields)) {
      if (def.type !== 'id' || def.list !== true) continue;
      for (const id of asList(card.fields[fieldName])) {
        if (cards[id] === undefined) {
          errors.push(`${card.id}: ${fieldName} '${id}' does not resolve to a card`);
        }
      }
    }

    // Every value of a list-enum field must come from its declared values or
    // source (F-024, ADR-021; e.g. a `touches` entry naming no configured area).
    for (const [fieldName, { allowed, source }] of listEnumAllowed) {
      for (const value of asList(card.fields[fieldName])) {
        if (!allowed.has(value)) {
          errors.push(
            `${card.id}: ${fieldName} '${value}' is not a value of ${source !== undefined ? `config '${source}'` : 'its enum'}`,
          );
        }
      }
    }

    // §5c fallback: when the registry doesn't type `touches` as a list-enum, its
    // entries must still name configured areas — touches without areas is
    // half-configured, not exempt.
    if (!listEnumAllowed.has('touches')) {
      for (const name of asList(card.fields['touches'])) {
        if (!Object.hasOwn(config.areas, name)) {
          errors.push(`${card.id}: touches '${name}' names no configured area`);
        }
      }
    }

    // Frontmatter property order (F-013): a warning, never an error.
    const present = Object.keys(card.fields).filter((key) => fieldOrder.includes(key));
    const expected = fieldOrder.filter((key) => present.includes(key));
    if (present.join(' ') !== expected.join(' ')) {
      warnings.push(`${card.id}: frontmatter keys out of order (expected ${expected.join(', ')})`);
    }
  }
}

/**
 * Two cards concurrently in flight — both in {@link inFlightColumn}, the column
 * before the last — that declare overlapping `touches` areas are heading for the
 * same files (F-024, ADR-021). A warning, never an error. Boards with fewer than
 * three columns have no in-flight column and are skipped.
 */
function validateInFlightOverlap(
  cards: Record<string, Card>,
  config: VaultConfig,
  warnings: string[],
): void {
  const column = inFlightColumn(config);
  if (column === null) return;
  const inFlight = Object.values(cards)
    .filter((card) => placeCard(card, config).column === column)
    .map((card) => ({ id: card.id, areas: asList(card.fields['touches']) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < inFlight.length; i++) {
    for (let j = i + 1; j < inFlight.length; j++) {
      const shared = inFlight[i].areas.filter((area) => inFlight[j].areas.includes(area));
      if (shared.length > 0) {
        warnings.push(
          `${inFlight[i].id} and ${inFlight[j].id}: both in '${column}' and declare overlapping area(s): ${shared.join(', ')}`,
        );
      }
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * The allowed-value set for each list-enum field, resolved once: its inline
 * `values`, else its `source` config list/map (via {@link enumValueEntries}, the
 * empty set when the source names no config key — so every declared value is
 * flagged rather than the check silently skipped). A field with neither is
 * absent from the map and unconstrained.
 */
function buildListEnumAllowed(
  config: VaultConfig,
): Map<string, { allowed: Set<string>; source: string | undefined }> {
  const result = new Map<string, { allowed: Set<string>; source: string | undefined }>();
  for (const [fieldName, def] of Object.entries(config.fields)) {
    if (def.type !== 'enum' || def.list !== true) continue;
    const hasInline = Array.isArray(def.values) && def.values.length > 0;
    if (!hasInline && def.source === undefined) continue; // no allowed-set to enforce
    const allowed = enumValueEntries(config, def.values, def.source).map(toName);
    result.set(fieldName, { allowed: new Set(allowed), source: def.source });
  }
  return result;
}

/**
 * A frontmatter list value as deduped name strings: an array, a lone scalar, or
 * none. Scalar entries (numbers/booleans) are stringified — matching the old
 * inlined parser, which turned every value into a string, so a numeric typo like
 * `dependsOn: [123]` is still flagged as unresolved rather than silently dropped.
 * Non-scalar entries (objects, nested arrays) have no name and are skipped.
 */
function asList(value: unknown): string[] {
  if (value == null) return [];
  const array = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const entry of array) {
    const name = scalarName(entry);
    if (name !== '' && !out.includes(name)) out.push(name);
  }
  return out;
}

/** A list entry as a name: a string, or a stringified number/boolean/bigint; `''` otherwise. */
function scalarName(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

/** An enum entry's value name: a plain string, or a dated value's `name` (§5d). */
function toName(value: unknown): string {
  if (typeof value === 'string') return value;
  if (isObject(value) && typeof value['name'] === 'string') return value['name'];
  return String(value);
}

/** A real ISO `YYYY-MM-DD` calendar date (rejects shapes like `2026-13-99`). */
function isValidIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_DATE.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

/** UTC-midnight epoch ms for a validated ISO date. */
function dateMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** A non-null, non-array object. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
