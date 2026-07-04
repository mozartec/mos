import { describe, expect, it } from 'vitest';
import { loadConfig, type VaultConfig } from './config.js';
import type { ParsedFile } from './parse-file.js';
import {
  applySearchChange,
  buildSearchIndex,
  fileScopes,
  foldSearchText,
  querySearch,
} from './search.js';

/** A config whose wiki includes every markdown file except a couple of areas, so
 * board cards overlap the wiki scope while `apps/`/`packages/` fall in neither. */
function overlapConfig(): VaultConfig {
  return loadConfig({
    wiki: { include: ['**/*.md'], exclude: ['apps/**', 'packages/**'], fields: [] },
    board: { include: ['board/**/*.md'], columns: ['Backlog', 'Done'] },
    references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*' },
    types: {},
  }).config;
}

function file(path: string, data: Record<string, unknown>, body: string): ParsedFile {
  return { path, data, body, errors: [] };
}

// ── foldSearchText: the one shared match rule ────────────────────────────────

describe('foldSearchText', () => {
  it('lowercases (case-insensitive)', () => {
    expect(foldSearchText('Search ENGINE')).toBe('search engine');
  });

  it('strips diacritics (accent-insensitive)', () => {
    expect(foldSearchText('Café RÉSUMÉ')).toBe('cafe resume');
    expect(foldSearchText('naïve über')).toBe('naive uber');
  });

  it('folds an empty string to empty', () => {
    expect(foldSearchText('')).toBe('');
  });
});

// ── fileScopes: the scope set (union, not partition) ─────────────────────────

describe('fileScopes', () => {
  it('tags a board card with BOTH scopes when the wiki includes it (overlap)', () => {
    expect(fileScopes('board/F-1.md', overlapConfig())).toEqual(['wiki', 'board']);
  });

  it('tags a prose doc as wiki-only', () => {
    expect(fileScopes('docs/guide.md', overlapConfig())).toEqual(['wiki']);
  });

  it('tags a file matching neither include as the empty set (a gap)', () => {
    // Excluded from the wiki, not under board.include — belongs to no scope.
    expect(fileScopes('packages/core/x.md', overlapConfig())).toEqual([]);
  });

  it('tags a board-only file when the wiki explicitly excludes the board', () => {
    const config = loadConfig({
      wiki: { include: ['**/*.md'], exclude: ['board/**'], fields: [] },
      board: { include: ['board/**/*.md'], columns: ['Backlog', 'Done'] },
      types: {},
    }).config;
    expect(fileScopes('board/F-1.md', config)).toEqual(['board']);
  });

  it('falls back to **/*.md when wiki.include is empty', () => {
    const config = loadConfig({
      wiki: { include: [], exclude: [], fields: [] },
      board: { include: ['board/**/*.md'], columns: ['Backlog', 'Done'] },
      types: {},
    }).config;
    expect(fileScopes('docs/x.md', config)).toContain('wiki');
  });

  it('normalizes Windows backslash paths before matching', () => {
    expect(fileScopes('board\\F-1.md', overlapConfig())).toEqual(['wiki', 'board']);
  });
});

// ── buildSearchIndex + querySearch: body search, title boost, ranking ────────

describe('buildSearchIndex / querySearch', () => {
  it('finds a body match and highlights the matched source region', () => {
    const index = buildSearchIndex(
      [file('docs/a.md', {}, 'The category of cats')],
      overlapConfig(),
    );
    const hits = querySearch(index, { q: 'cat' });
    expect(hits).toHaveLength(1);
    expect(hits[0].path).toBe('docs/a.md');
    // `cat` first hits inside `category`.
    expect(hits[0].snippet?.match).toBe('cat');
  });

  it('boosts a title match above a body-only match', () => {
    const index = buildSearchIndex(
      [
        file('board/A.md', { title: 'Search Engine' }, 'nothing relevant here'),
        file('board/B.md', { title: 'Other' }, 'the search bar lives here'),
      ],
      overlapConfig(),
    );
    const hits = querySearch(index, { q: 'search' });
    expect(hits.map((h) => h.path)).toEqual(['board/A.md', 'board/B.md']);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    // A title-only hit carries no body snippet; a body hit does.
    expect(hits[0].snippet).toBeNull();
    expect(hits[1].snippet?.match.toLowerCase()).toBe('search');
  });

  it('ranks a doc with more occurrences higher (match-count ranking)', () => {
    const index = buildSearchIndex(
      [file('docs/one.md', {}, 'ping'), file('docs/many.md', {}, 'ping ping ping')],
      overlapConfig(),
    );
    const hits = querySearch(index, { q: 'ping' });
    expect(hits.map((h) => h.path)).toEqual(['docs/many.md', 'docs/one.md']);
    expect(hits[0].score).toBe(3);
    expect(hits[1].score).toBe(1);
  });

  it('breaks score ties by path, deterministically', () => {
    const index = buildSearchIndex(
      [file('docs/z.md', {}, 'term'), file('docs/a.md', {}, 'term'), file('docs/m.md', {}, 'term')],
      overlapConfig(),
    );
    expect(querySearch(index, { q: 'term' }).map((h) => h.path)).toEqual([
      'docs/a.md',
      'docs/m.md',
      'docs/z.md',
    ]);
  });

  it('coerces a non-string scalar title so it is searchable, as the board model does', () => {
    // YAML parses `title: 2026` as a number; buildModel stringifies it via
    // asScalarString, and search must agree so the same card is found by `2026`.
    const index = buildSearchIndex(
      [file('board/F-1.md', { title: 2026 }, 'body')],
      overlapConfig(),
    );
    expect(querySearch(index, { q: '2026' }).map((h) => h.path)).toEqual(['board/F-1.md']);
  });

  it('is case- and accent-insensitive end to end', () => {
    const index = buildSearchIndex([file('docs/a.md', {}, 'A lovely Café')], overlapConfig());
    const hits = querySearch(index, { q: 'cafe' });
    expect(hits).toHaveLength(1);
    expect(hits[0].snippet?.match).toBe('Café');
  });

  it('treats an empty or whitespace-only query as no search (not a hunt for space runs)', () => {
    // A body WITH consecutive spaces — a whitespace query would otherwise match
    // these runs (tables, double-space-after-period) instead of returning [].
    const index = buildSearchIndex(
      [file('docs/a.md', {}, 'hello   world  again')],
      overlapConfig(),
    );
    expect(querySearch(index, { q: '' })).toEqual([]);
    expect(querySearch(index, { q: '   ' })).toEqual([]);
    expect(querySearch(index, { q: '\t \n' })).toEqual([]);
  });

  it('trims surrounding whitespace off a real query (matching the board filter rule)', () => {
    const index = buildSearchIndex([file('docs/a.md', {}, 'the world is round')], overlapConfig());
    expect(querySearch(index, { q: '  world  ' }).map((h) => h.path)).toEqual(['docs/a.md']);
  });

  it('is pure: neither building nor querying throws or mutates the index', () => {
    const files = [file('docs/a.md', { title: 42 }, 'plain body')];
    const index = buildSearchIndex(files, overlapConfig());
    const snapshot = JSON.stringify(index);
    querySearch(index, { q: 'body' });
    expect(JSON.stringify(index)).toBe(snapshot);
    // A non-string title is tolerated (folded to '') rather than crashing.
    expect(() =>
      buildSearchIndex([file('docs/b.md', { title: 42 }, '')], overlapConfig()),
    ).not.toThrow();
    expect(querySearch(buildSearchIndex([], overlapConfig()), { q: 'x' })).toEqual([]);
  });
});

// ── scope filtering: a union, never assuming board ⊎ wiki partitions ──────────

describe('querySearch scope filter', () => {
  const config = overlapConfig();
  const index = buildSearchIndex(
    [
      file('board/F-1.md', {}, 'alpha'), // wiki + board (overlap)
      file('docs/d.md', {}, 'alpha'), // wiki only
      file('apps/web/x.md', {}, 'alpha'), // neither (gap)
    ],
    config,
  );

  it('all = the wiki ∪ board union, excluding gap files', () => {
    expect(querySearch(index, { q: 'alpha', scope: 'all' }).map((h) => h.path)).toEqual([
      'board/F-1.md',
      'docs/d.md',
    ]);
  });

  it('wiki includes the overlapping board card', () => {
    expect(querySearch(index, { q: 'alpha', scope: 'wiki' }).map((h) => h.path)).toEqual([
      'board/F-1.md',
      'docs/d.md',
    ]);
  });

  it('board returns only board-scope files', () => {
    expect(querySearch(index, { q: 'alpha', scope: 'board' }).map((h) => h.path)).toEqual([
      'board/F-1.md',
    ]);
  });

  it('reports the full scope set on each hit', () => {
    const hit = querySearch(index, { q: 'alpha', scope: 'board' })[0];
    expect(hit.scopes).toEqual(['wiki', 'board']);
  });

  it('returns a copied scope array — mutating a hit cannot corrupt the index', () => {
    const hit = querySearch(index, { q: 'alpha', scope: 'board' })[0];
    hit.scopes.push('board'); // a caller mutates the returned array
    // The index's own doc is untouched; a fresh query still reports the true set.
    expect(querySearch(index, { q: 'alpha', scope: 'board' })[0].scopes).toEqual(['wiki', 'board']);
  });
});

// ── snippet offsets index the SOURCE body string ─────────────────────────────

describe('snippet offsets', () => {
  it('land on the source body so body.slice(start,end) === match', () => {
    const body = 'The Café is nice';
    const index = buildSearchIndex([file('docs/a.md', {}, body)], overlapConfig());
    const snippet = querySearch(index, { q: 'cafe' })[0].snippet;
    expect(snippet).not.toBeNull();
    if (snippet === null) return;
    expect(body.slice(snippet.start, snippet.end)).toBe(snippet.match);
    expect(snippet.match).toBe('Café'); // source form, accent preserved
    expect(snippet.start).toBe(4);
    expect(snippet.end).toBe(8);
    expect(snippet.before).toBe('The ');
    expect(snippet.after).toBe(' is nice');
  });

  it('windows long context around the match to the snippet radius', () => {
    const body = `${'x'.repeat(100)}needle${'y'.repeat(100)}`;
    const index = buildSearchIndex([file('docs/a.md', {}, body)], overlapConfig());
    const snippet = querySearch(index, { q: 'needle' })[0].snippet;
    expect(snippet?.match).toBe('needle');
    expect(snippet?.before).toBe('x'.repeat(40));
    expect(snippet?.after).toBe('y'.repeat(40));
    // Offsets still address the full source body, not the window.
    expect(snippet && body.slice(snippet.start, snippet.end)).toBe('needle');
  });
});

// ── applySearchChange: add / replace / remove, mirroring applyFileChange ──────

describe('applySearchChange', () => {
  const config = overlapConfig();
  function base() {
    return buildSearchIndex(
      [file('board/A.md', {}, 'alpha'), file('board/B.md', {}, 'beta')],
      config,
    );
  }

  it('removes a file when the change is a deletion (null)', () => {
    const next = applySearchChange(base(), config, 'board/A.md', null);
    expect(querySearch(next, { q: 'alpha' })).toEqual([]);
    expect(querySearch(next, { q: 'beta' }).map((h) => h.path)).toEqual(['board/B.md']);
  });

  it('adds a new file', () => {
    const next = applySearchChange(base(), config, 'board/C.md', file('board/C.md', {}, 'gamma'));
    expect(querySearch(next, { q: 'gamma' }).map((h) => h.path)).toEqual(['board/C.md']);
  });

  it('replaces a file in place, keeping its slot', () => {
    const next = applySearchChange(base(), config, 'board/A.md', file('board/A.md', {}, 'delta'));
    expect(querySearch(next, { q: 'alpha' })).toEqual([]);
    expect(querySearch(next, { q: 'delta' }).map((h) => h.path)).toEqual(['board/A.md']);
    expect(next.docs[0].path).toBe('board/A.md'); // same position as before
  });

  it('normalizes Windows paths when locating the file to change', () => {
    const next = applySearchChange(base(), config, 'board\\A.md', null);
    expect(querySearch(next, { q: 'alpha' })).toEqual([]);
  });

  it('returns a new index without mutating the input', () => {
    const index = base();
    const snapshot = JSON.stringify(index);
    applySearchChange(index, config, 'board/A.md', null);
    expect(JSON.stringify(index)).toBe(snapshot);
    expect(querySearch(index, { q: 'alpha' }).map((h) => h.path)).toEqual(['board/A.md']);
  });
});
