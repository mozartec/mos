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

/**
 * One in-document match as **source** offsets: `source.slice(start, end)` is the
 * original text that matched, its case and diacritics intact. Returned by
 * {@link findFoldedMatches} for the reader's highlight pass (F-036-S-03).
 */
export interface FoldedMatch {
  start: number;
  end: number;
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
 * `toPosixPath` membership {@link buildModel} uses — no fallback of its own, so
 * search and the wiki file tree never disagree. `'wiki'` when the path matches
 * `wiki.include` minus `wiki.exclude`; `'board'` when it matches `board.include`.
 * A path may match both, one, or neither — a union, not a partition.
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

/**
 * Every non-overlapping match of `query` in `source` under the shared fold rule,
 * as **source** offsets. This is the single matcher the snippet extractor and the
 * in-document highlighter (F-036-S-03) both run through {@link matchFoldedNeedle},
 * so they never disagree on what a hit is — case- and accent-insensitively —
 * instead of a second, divergent tokenizer. A blank query, or one that folds
 * away, yields `[]`. Offsets sit on code-point boundaries and swallow trailing
 * combining marks, so a slice is always a whole grapheme run (no split surrogate,
 * no orphaned accent). Pure — returns a fresh array, mutates nothing.
 *
 * The match set is over the given `source` string; a caller that applies it to
 * already-rendered DOM runs it per visible text node, so a hit that the whole-body
 * index sees spanning a skipped element (a link or code span, F-003-S-03) can be
 * absent here — by design, since those boundaries are never decorated.
 */
export function findFoldedMatches(source: string, query: string): FoldedMatch[] {
  return matchFoldedNeedle(source, foldSearchText(query.trim()));
}

// ── internals ──────────────────────────────────────────────────────────────

/** The compiled scope membership tests, built once per index/change. */
interface ScopeMatchers {
  wikiInclude: RegExp[];
  wikiExclude: RegExp[];
  board: RegExp[];
}

/**
 * Compile a config's scope globs once — the *same* globs {@link buildModel}
 * compiles, verbatim. No empty-`wiki.include` fallback: buildModel treats an
 * empty include as matching no wiki files, and search mirrors that so a hit can
 * never point at a doc the wiki tree omits.
 */
function scopeMatchers(config: VaultConfig): ScopeMatchers {
  return {
    wikiInclude: config.wiki.include.map(globToRegExp),
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
 * All non-overlapping matches of an **already-folded** `needle` in `source`, as
 * source offsets — the shared core of {@link findFoldedMatches} and
 * {@link extractSnippet}, so a folded→source correction lands in exactly one
 * place. A map-free precheck (fold to a plain string, no offset arrays) bails
 * before the per-code-point map is built, which matters on the highlighter's hot
 * path where most text nodes never match. `end` is extended over any immediately
 * following combining marks that folded away (NFD source, e.g. `e`+U+0301) so the
 * accent stays inside the match rather than being severed after it.
 */
function matchFoldedNeedle(source: string, needle: string): FoldedMatch[] {
  if (needle === '') return [];
  // Cheap precheck: skip the offset-map allocation for a source with no match.
  if (!foldSearchText(source).includes(needle)) return [];

  const { folded, srcStart, srcEnd } = foldWithMap(source);
  const matches: FoldedMatch[] = [];
  let from = 0;
  for (;;) {
    const at = folded.indexOf(needle, from);
    if (at < 0) break;
    const start = srcStart[at];
    const end = extendOverCombiningMarks(source, srcEnd[at + needle.length - 1]);
    matches.push({ start, end });
    from = at + needle.length;
  }
  return matches;
}

/**
 * Advance `end` past any source code points that fold to nothing — trailing
 * combining marks on NFD-decomposed text — so a match that landed on the base
 * character keeps its accent inside `[start, end)`.
 */
function extendOverCombiningMarks(source: string, end: number): number {
  let i = end;
  while (i < source.length) {
    const cp = source.codePointAt(i);
    if (cp === undefined) break;
    const width = cp > 0xffff ? 2 : 1;
    if (foldCodePoint(source.slice(i, i + width)) !== '') break;
    i += width;
  }
  return i;
}

/**
 * Extract a snippet around the first body occurrence of `needle` (folded). The
 * offsets come from {@link matchFoldedNeedle} (source-body offsets, accents and
 * case preserved, combining marks kept whole); this only adds the fixed-radius
 * context windows. Returns `null` when the folded query isn't in the body.
 */
function extractSnippet(doc: SearchDoc, needle: string): SearchSnippet | null {
  const body = doc.body;
  const first = matchFoldedNeedle(body, needle)[0];
  if (first === undefined) return null;

  const { start, end } = first;
  // `start`/`end` sit on code-point boundaries, so `match` is always well-formed.
  // Only the context windows, cut at a fixed UTF-16 radius, can bisect a surrogate
  // pair — nudge each truncated edge off the orphaned half so no stray � shows.
  const before = body.slice(clampWindowStart(body, Math.max(0, start - SNIPPET_RADIUS)), start);
  const match = body.slice(start, end);
  const after = body.slice(end, clampWindowEnd(body, Math.min(body.length, end + SNIPPET_RADIUS)));

  return { start, end, before, match, after };
}

/**
 * A window start moved off an orphaned low surrogate: when the radius cut lands
 * on the *second* half of a pair (`from > 0` guards against a genuine leading
 * lone surrogate at the body's start), advance one unit past it.
 */
function clampWindowStart(text: string, from: number): number {
  return from > 0 && isLowSurrogate(text.charCodeAt(from)) ? from + 1 : from;
}

/**
 * A window end moved off an orphaned high surrogate: when the radius cut leaves
 * a pair's *first* half as the last included unit (`to < length` means we truly
 * truncated, so the matching low half sits just outside), retreat one unit.
 */
function clampWindowEnd(text: string, to: number): number {
  return to < text.length && isHighSurrogate(text.charCodeAt(to - 1)) ? to - 1 : to;
}

/** True for a UTF-16 high surrogate — the first unit of an astral code point. */
function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** True for a UTF-16 low surrogate — the second unit of an astral code point. */
function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
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
