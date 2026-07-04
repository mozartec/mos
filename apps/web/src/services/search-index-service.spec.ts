import { TestBed } from '@angular/core/testing';
import { SearchIndexService } from './search-index-service';
import { VAULT_SOURCE } from '../sources/vault-source.token';
import { InMemoryVaultSource } from '../testing/test-helpers';

/**
 * The service is I/O + the built index only; the matching, ranking, and snippet
 * logic it exercises is the pure core's (covered exhaustively in
 * `packages/core`). These specs pin the app-side contract: one body-retaining
 * read, a lazily-built index, scoped queries, and rebuild-on-entry.
 */

/** Wiki excludes the board folder, so scope is a clean docs/board partition. */
const CONFIG = JSON.stringify({
  specVersion: '0.4',
  wiki: { include: ['**/*.md'], exclude: ['board/**'] },
  board: { include: ['board/**/*.md'], columns: [] },
  types: {},
});

const FILES: Record<string, string> = {
  '.mos/config.json': CONFIG,
  'docs/guide.md': '# Guide\n\nThe aardvark forages at dusk.',
  'docs/other.md': '# Other\n\nNothing notable here.',
  'board/T-100.md': [
    '---',
    'id: T-100',
    'type: task',
    'title: Aardvark card',
    'status: Todo',
    '---',
    '',
    '# T-100',
    '',
    'A board note about the aardvark.',
  ].join('\n'),
};

function makeService(files: Record<string, string> = FILES): {
  service: SearchIndexService;
  source: InMemoryVaultSource;
} {
  const source = new InMemoryVaultSource({ ...files });
  TestBed.configureTestingModule({
    providers: [{ provide: VAULT_SOURCE, useValue: source }],
  });
  return { service: TestBed.inject(SearchIndexService), source };
}

describe('SearchIndexService', () => {
  it('has no index and returns no hits before the first load', () => {
    const { service } = makeService();
    expect(service.index()).toBeNull();
    expect(service.query({ q: 'aardvark' })).toEqual([]);
  });

  it('loads the whole vault body-retaining and builds a queryable index', async () => {
    const { service } = makeService();
    const load = await service.load();

    // The snapshot keeps bodies (the gap the wiki left) and every path.
    expect(load.config.board.include).toContain('board/**/*.md');
    expect(load.paths).toEqual(
      expect.arrayContaining(['docs/guide.md', 'docs/other.md', 'board/T-100.md']),
    );
    const guide = load.files.find((f) => f.path === 'docs/guide.md');
    expect(guide?.body).toContain('aardvark');

    // The index is built and answers a body query with a source-offset snippet.
    expect(service.index()).not.toBeNull();
    const hits = service.query({ q: 'aardvark' });
    expect(hits.map((h) => h.path).sort()).toEqual(['board/T-100.md', 'docs/guide.md']);
    const guideHit = hits.find((h) => h.path === 'docs/guide.md');
    expect(guideHit?.snippet?.match).toBe('aardvark');
  });

  it('scopes queries through the core fileScopes (wiki vs board)', async () => {
    const { service } = makeService();
    await service.load();

    expect(service.query({ q: 'aardvark', scope: 'wiki' }).map((h) => h.path)).toEqual([
      'docs/guide.md',
    ]);
    expect(service.query({ q: 'aardvark', scope: 'board' }).map((h) => h.path)).toEqual([
      'board/T-100.md',
    ]);
  });

  it('coalesces concurrent load() calls onto one in-flight read', () => {
    const { service } = makeService();
    const first = service.load();
    const second = service.load();
    expect(second).toBe(first);
  });

  it('rebuilds on each fresh load() — re-reading the vault (rebuild on entry)', async () => {
    const { service, source } = makeService();
    await service.load();
    const readsAfterFirst = source.readPaths.length;
    expect(readsAfterFirst).toBeGreaterThan(0);

    await service.load();
    expect(source.readPaths.length).toBeGreaterThan(readsAfterFirst);
  });

  it('keeps the last good index when a reload fails (search stays alive)', async () => {
    const { service, source } = makeService();
    await service.load();
    expect(service.query({ q: 'aardvark' }).length).toBe(2);

    // A transient failure on the next load must not blank the index.
    source.listFiles = () => Promise.reject(new Error('transient'));
    await expect(service.load()).rejects.toThrow('transient');

    expect(service.index()).not.toBeNull();
    expect(service.query({ q: 'aardvark' }).length).toBe(2);
  });

  it('degrades gracefully when a file cannot be read', async () => {
    const source = new InMemoryVaultSource({ ...FILES });
    // Make one file unreadable; it should be omitted, not crash the load.
    const original = source.readFile.bind(source);
    source.readFile = (path: string) =>
      path === 'docs/other.md' ? Promise.reject(new Error('boom')) : original(path);

    TestBed.configureTestingModule({ providers: [{ provide: VAULT_SOURCE, useValue: source }] });
    const service = TestBed.inject(SearchIndexService);

    const load = await service.load();
    expect(load.files.some((f) => f.path === 'docs/other.md')).toBe(false);
    // The path is still listed (the tree shows it); only the parse was skipped.
    expect(load.paths).toContain('docs/other.md');
    expect(service.query({ q: 'aardvark' }).length).toBe(2);
  });
});
