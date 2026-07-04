/**
 * Pure-core full-text search over vault file bodies and titles (F-036-S-01).
 *
 * The engine every search surface builds on: it indexes each parsed file's
 * `title` (weighted over body) and full `body`, answers scoped queries with
 * ranked hits, and returns snippet offsets into the **source** body text for
 * highlighting. Pure (ADR-001) — no fs/network/framework, no new dependency,
 * no throw on odd input; the app feeds it `ParsedFile[]`.
 *
 * One folded match rule (lowercased, diacritic-stripped) — extending the
 * `cardSearchText` rule (filters.ts) from frontmatter to bodies — lives here as
 * the single source the index, the snippet extractor, and (later, S-03) the DOM
 * highlighter all reuse, so they never disagree on what counts as a hit.
 *
 * The `SearchIndex`/`querySearch` boundary is intentionally engine-agnostic: a
 * MiniSearch-backed implementation (F-036) could satisfy the same signatures
 * later without any caller change. v1 is a hand-rolled folded-substring scan.
 */

import type { VaultConfig } from './config.js';
import { asScalarString } from './models.js';
import type { ParsedFile } from './parse-file.js';
import { globToRegExp, toPosixPath } from './path-glob.js';

/** A scope a file can belong to. A file may be in **both** (overlap). */
export type SearchScope = 'wiki' | 'board';

/** A query's scope filter: a single scope, or `'all'` = the union of both. */
export type SearchScopeFilter = 'all' | SearchScope;

/**
 * One indexed file. Keeps the **source** `title`/`body` (snippet offsets index
 * these) alongside their folded forms (ranking and matching read these), plus
 * the file's scope **set** — never assume board and wiki partition the vault.
 */
export interface SearchDoc {
  path: string;
  title: string;
  body: string;
  scopes: SearchScope[];
  foldedTitle: string;
  foldedBody: string;
}

/** The built index: the docs to scan. Opaque to callers beyond this module. */
export interface SearchIndex {
  docs: SearchDoc[];
}

/**
 * A snippet around the first body match. `start`/`end` are offsets into the
 * **source** body string (so `body.slice(start, end) === match`); the
 * `before`/`match`/`after` segments are a windowed convenience for rendering
 * `…{before}<mark>{match}</mark>{after}…` without re-slicing.
 */
export interface SearchSnippet {
  start: number;
  end: number;
  before: string;
  match: string;
  after: string;
}

/** One ranked search result. */
export interface SearchHit {
  path: string;
  title: string;
  /** The file's scope set (both when it overlaps wiki and board). */
  scopes: SearchScope[];
  /** Title-weighted match count; higher ranks first. */
  score: number;
  /** Snippet around the first body match, or `null` for a title-only hit. */
  snippet: SearchSnippet | null;
}

/** A search request: the raw query and an optional scope (default `'all'`). */
export interface SearchQuery {
  q: string;
  scope?: SearchScopeFilter;
}

/** How much a title match outweighs a body match in the v1 ranking. */
const TITLE_WEIGHT = 10;

/** Characters of source body kept on each side of a match in a snippet. */
const SNIPPET_RADIUS = 40;

/** Unicode combining marks (U+0300–U+036F) — stripped after NFD to fold away diacritics. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Fold text to its matchable form: NFD-decompose, drop combining marks
 * (accent-insensitive), then lowercase (case-insensitive). The one shared rule
 * — the index, the snippet extractor, and the DOM highlighter (F-036-S-03) all
 * fold through here so a query and its target agree on what a hit is. Folds per
 * code point like {@link foldWithMap}, but without the offset map — so indexing
 * every title and body doesn't allocate arrays it immediately discards.
 */
export function foldSearchText(text: string): string {
  let folded = '';
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i);
    if (cp === undefined) break;
    const width = cp > 0xffff ? 2 : 1;
    folded += foldCodePoint(text.slice(i, i + width));
    i += width;
  }
  return folded;
}

/** NFD-decompose, strip combining marks, lowercase — the atomic fold step. */
function foldCodePoint(unit: string): string {
  return unit.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/**
 * The scope **set** a path belongs to, via the exact `globToRegExp`/
 * `toPosixPath` membership {@link buildModel} uses. `'wiki'` when the path
 * matches `wiki.include` (an empty list falls back to `['**\/*.md']`) minus
 * `wiki.exclude`; `'board'` when it matches `board.include`. A path may match
 * both, one, or neither — the set is a union, not a partition.
 */
export function fileScopes(path: string, config: VaultConfig): SearchScope[] {
  return matchScopes(toPosixPath(path), scopeMatchers(config));
}

/**
 * Build a search index from parsed files. Every file becomes a {@link SearchDoc}
 * tagged with its scope set; titles and bodies are folded once here so queries
 * never re-fold the whole corpus. Pure and total — never throws.
 */
export function buildSearchIndex(files: ParsedFile[], config: VaultConfig): SearchIndex {
  const matchers = scopeMatchers(config);
  return { docs: files.map((file) => makeDoc(file, matchers)) };
}

/**
 * Answer a scoped query with ranked hits. Filters docs by `scope` (`'all'` =
 * the wiki∪board union), ranks by title-weighted match count, and breaks ties
 * by path so results are stable. An empty, whitespace-only, or all-folded-away
 * query returns `[]`. Pure — returns a fresh array, mutates nothing.
 */
export function querySearch(index: SearchIndex, query: SearchQuery): SearchHit[] {
  const scope = query.scope ?? 'all';
  // Trim first — matching `cardSearchText`/`matchesFilters` — so a
  // whitespace-only query is "no search" rather than a hunt for space runs.
  const needle = foldSearchText(query.q.trim());
  if (needle === '') return [];

  const hits: SearchHit[] = [];
  for (const doc of index.docs) {
    if (!inScope(doc, scope)) continue;
    const titleCount = countMatches(doc.foldedTitle, needle);
    const bodyCount = countMatches(doc.foldedBody, needle);
    if (titleCount === 0 && bodyCount === 0) continue;
    hits.push({
      path: doc.path,
      title: doc.title,
      // Copy, not alias: a caller mutating a hit's scopes must not reach back
      // into the index's own doc (shared onward by applySearchChange too).
      scopes: [...doc.scopes],
      score: titleCount * TITLE_WEIGHT + bodyCount,
      snippet: bodyCount > 0 ? extractSnippet(doc, needle) : null,
    });
  }

  hits.sort((a, b) => b.score - a.score || comparePath(a.path, b.path));
  return hits;
}

/**
 * Add, replace, or remove one path's doc, mirroring {@link applyFileChange}:
 * every trace of `path` is dropped, then — unless `file` is `null` (deleted) —
 * the freshly parsed file is re-indexed in the **same slot** it held (or
 * appended when new). Returns a **new** index; the input is never mutated.
 */
export function applySearchChange(
  index: SearchIndex,
  config: VaultConfig,
  path: string,
  file: ParsedFile | null,
): SearchIndex {
  const rel = toPosixPath(path);
  const previousIndex = index.docs.findIndex((doc) => toPosixPath(doc.path) === rel);
  const docs = index.docs.filter((doc) => toPosixPath(doc.path) !== rel);

  if (file !== null) {
    const doc = makeDoc(file, scopeMatchers(config));
    if (previousIndex >= 0) docs.splice(previousIndex, 0, doc);
    else docs.push(doc);
  }

  return { docs };
}

// ── internals ──────────────────────────────────────────────────────────────

/** The compiled scope membership tests, built once per index/change. */
interface ScopeMatchers {
  wikiInclude: RegExp[];
  wikiExclude: RegExp[];
  board: RegExp[];
}

/**
 * Compile a config's scope globs once. An empty `wiki.include` falls back to
 * `['**\/*.md']` — the documented default the wiki loader applies — so a config
 * that leaves it blank still scopes markdown into the wiki.
 */
function scopeMatchers(config: VaultConfig): ScopeMatchers {
  const wikiInclude = config.wiki.include.length > 0 ? config.wiki.include : ['**/*.md'];
  return {
    wikiInclude: wikiInclude.map(globToRegExp),
    wikiExclude: config.wiki.exclude.map(globToRegExp),
    board: config.board.include.map(globToRegExp),
  };
}

/** The scope set for an already-POSIX-normalized path. */
function matchScopes(rel: string, m: ScopeMatchers): SearchScope[] {
  const scopes: SearchScope[] = [];
  if (m.wikiInclude.some((re) => re.test(rel)) && !m.wikiExclude.some((re) => re.test(rel))) {
    scopes.push('wiki');
  }
  if (m.board.some((re) => re.test(rel))) scopes.push('board');
  return scopes;
}

/** Turn one parsed file into an indexed doc, folding title and body once. */
function makeDoc(file: ParsedFile, matchers: ScopeMatchers): SearchDoc {
  // Coerce via the same rule `buildModel` uses (asScalarString) so a non-string
  // scalar title — e.g. YAML `title: 2026` — is searchable here exactly as it is
  // on the board, rather than dropped to '' by a bare `typeof` check.
  const title = asScalarString(file.data['title']);
  return {
    path: file.path,
    title,
    body: file.body,
    scopes: matchScopes(toPosixPath(file.path), matchers),
    foldedTitle: foldSearchText(title),
    foldedBody: foldSearchText(file.body),
  };
}

/** True when `doc` passes the `scope` filter (`'all'` = in wiki or board). */
function inScope(doc: SearchDoc, scope: SearchScopeFilter): boolean {
  return scope === 'all' ? doc.scopes.length > 0 : doc.scopes.includes(scope);
}

/** Count non-overlapping occurrences of `needle` in `haystack` (both folded). */
function countMatches(haystack: string, needle: string): number {
  if (needle === '') return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

/** Deterministic path order for stable tie-breaking (not locale-sensitive). */
function comparePath(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Extract a snippet around the first body occurrence of `needle` (folded). The
 * returned offsets index the **source** body — the fold map translates the
 * folded match position back to source, so accents and case in the source are
 * preserved in `match`. Returns `null` when the folded query isn't in the body.
 */
function extractSnippet(doc: SearchDoc, needle: string): SearchSnippet | null {
  const { folded, srcStart, srcEnd } = foldWithMap(doc.body);
  const at = folded.indexOf(needle);
  if (at < 0) return null;

  const start = srcStart[at];
  const end = srcEnd[at + needle.length - 1];
  const before = doc.body.slice(Math.max(0, start - SNIPPET_RADIUS), start);
  const match = doc.body.slice(start, end);
  const after = doc.body.slice(end, Math.min(doc.body.length, end + SNIPPET_RADIUS));

  return { start, end, before, match, after };
}

/**
 * Fold `source` per code point, recording for each folded character the source
 * offsets of the code point that produced it. Folding a single source code
 * point in isolation matches whole-string folding for the Latin/accented text
 * mos indexes, while keeping an exact folded→source offset map — so a folded
 * match can be reported as source-body offsets (a diacritic constraint of the
 * card). A code point that folds away (e.g. a bare combining mark) contributes
 * no folded characters and simply drops out of the map.
 */
function foldWithMap(source: string): { folded: string; srcStart: number[]; srcEnd: number[] } {
  let folded = '';
  const srcStart: number[] = [];
  const srcEnd: number[] = [];

  for (let i = 0; i < source.length; ) {
    const cp = source.codePointAt(i);
    if (cp === undefined) break;
    const width = cp > 0xffff ? 2 : 1;
    const foldedChar = foldCodePoint(source.slice(i, i + width));
    // One map entry per UTF-16 unit of the folded output, so the arrays stay
    // aligned with `folded`'s own UTF-16 indices (what `indexOf` returns).
    for (let unit = 0; unit < foldedChar.length; unit += 1) {
      srcStart.push(i);
      srcEnd.push(i + width);
    }
    folded += foldedChar;
    i += width;
  }

  return { folded, srcStart, srcEnd };
}
