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

/**
 * Live re-index (F-036-S-04): once an index exists, the service patches itself
 * from `source.watch` — per-file for ordinary changes, a full {@link
 * SearchIndexService.load} for a config change — without any view driving it.
 */
describe('SearchIndexService — live re-index (F-036-S-04)', () => {
  it('does not react to watch events before the first load (nothing built to patch)', async () => {
    const { service, source } = makeService();
    source.files['docs/guide.md'] = '# Guide\n\nA freshly minted mongoose fact.';
    source.emit('docs/guide.md');
    await flush();

    // Still unbuilt — the eventual first load reads current disk state anyway.
    expect(service.index()).toBeNull();
  });

  it('patches only the changed file on edit, at the cost of one re-read', async () => {
    const { service, source } = makeService();
    await service.load();
    const readsAfterLoad = source.readPaths.length;

    source.files['docs/guide.md'] = '# Guide\n\nThe aardvark now forages a mongoose too.';
    source.emit('docs/guide.md');
    await flush();

    // One re-read for the changed path — not a whole-vault reload.
    expect(source.readPaths.length).toBe(readsAfterLoad + 1);
    expect(source.readPaths.at(-1)).toBe('docs/guide.md');

    const hits = service.query({ q: 'mongoose' });
    expect(hits.map((h) => h.path)).toEqual(['docs/guide.md']);
    // The other doc is untouched and still queryable.
    expect(
      service
        .query({ q: 'aardvark' })
        .map((h) => h.path)
        .sort(),
    ).toEqual(['board/T-100.md', 'docs/guide.md']);
  });

  it('adds a newly created file to the index on watch', async () => {
    const { service, source } = makeService();
    await service.load();

    source.files['docs/new.md'] = '# New\n\nA lemur sighting.';
    source.emit('docs/new.md');
    await flush();

    expect(service.query({ q: 'lemur' }).map((h) => h.path)).toEqual(['docs/new.md']);
  });

  it('drops a deleted file from the index on watch', async () => {
    const { service, source } = makeService();
    await service.load();
    expect(service.query({ q: 'aardvark' }).length).toBe(2);

    delete source.files['docs/guide.md'];
    source.emit('docs/guide.md');
    await flush();

    const hits = service.query({ q: 'aardvark' });
    expect(hits.map((h) => h.path)).toEqual(['board/T-100.md']);
  });

  it('fully rebuilds when .mos/config.json changes, re-scoping every doc', async () => {
    const { service, source } = makeService();
    await service.load();
    // Widen the scope to include board/**, so a board card also carries `wiki`.
    source.files['.mos/config.json'] = JSON.stringify({
      specVersion: '0.4',
      wiki: { include: ['**/*.md'], exclude: [] },
      board: { include: ['board/**/*.md'], columns: [] },
      types: {},
    });

    source.emit('.mos/config.json');
    // A config change triggers a fresh load() synchronously; coalesce onto it
    // instead of guessing how many ticks the rebuild takes.
    await service.load();

    const hit = service
      .query({ q: 'aardvark', scope: 'wiki' })
      .find((h) => h.path === 'board/T-100.md');
    expect(hit).toBeDefined();
  });

  it('disposes the watch subscription when the service is torn down (no leak)', () => {
    const { source } = makeService();
    TestBed.resetTestingModule();
    expect(source.unwatchedCount).toBe(1);
  });

  it('logs rather than swallows a config-triggered rebuild that fails', async () => {
    const { service, source } = makeService();
    await service.load();
    expect(service.query({ q: 'aardvark' }).length).toBe(2);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    source.listFiles = () => Promise.reject(new Error('disk unavailable'));

    // Unlike WikiView's `loadFiles()`, nothing awaits this internally
    // triggered reload — its rejection must be reported, not vanish.
    source.emit('.mos/config.json');
    await flush();

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('.mos/config.json'),
      expect.any(Error),
    );
    // Same guarantee as a directly-awaited failed load(): the last good
    // index survives.
    expect(service.query({ q: 'aardvark' }).length).toBe(2);

    consoleError.mockRestore();
  });

  // ── No lost updates when watch events overlap ──────────────────────────
  //
  // `onFileChange` awaits a `readFile` before committing its patch. If two
  // handlers' commits interleave, a naive implementation that captured the
  // pre-await index/config would clobber whichever committed first. These
  // specs force that interleaving via a manually-controlled deferred read.

  it('does not lose an update when two file edits overlap', async () => {
    const { service, source } = makeService();
    await service.load();

    // Hold back docs/guide.md's read so docs/other.md's patch commits first.
    let resolveGuideRead!: (value: string) => void;
    const pendingGuideRead = new Promise<string>((resolve) => {
      resolveGuideRead = resolve;
    });
    const originalReadFile = source.readFile.bind(source);
    source.readFile = (path: string) =>
      path === 'docs/guide.md' ? pendingGuideRead : originalReadFile(path);

    source.emit('docs/guide.md'); // stuck awaiting pendingGuideRead
    source.files['docs/other.md'] = '# Other\n\nA lemur passes through.';
    source.emit('docs/other.md'); // reads immediately and commits first
    await flush();
    expect(service.query({ q: 'lemur' }).map((h) => h.path)).toEqual(['docs/other.md']);

    // Release the held-back read; its commit must build on the already-
    // committed docs/other.md patch, not revert it.
    resolveGuideRead('# Guide\n\nThe aardvark now meets a mongoose.');
    await flush();

    expect(service.query({ q: 'mongoose' }).map((h) => h.path)).toEqual(['docs/guide.md']);
    expect(service.query({ q: 'lemur' }).map((h) => h.path)).toEqual(['docs/other.md']);
  });

  it('does not let a delayed patch revert a full reload that finished first', async () => {
    const { service, source } = makeService();
    await service.load();

    // Hold back the patch's own read of docs/guide.md.
    let resolveGuideRead!: (value: string) => void;
    const pendingGuideRead = new Promise<string>((resolve) => {
      resolveGuideRead = resolve;
    });
    const originalReadFile = source.readFile.bind(source);
    // Hold back only the *first* read of docs/guide.md (the patch's own
    // call) — the reload below re-reads the whole vault, including
    // docs/guide.md a second time, and that call must go through normally or
    // the reload would deadlock on the same held-back promise.
    let guideReadCalls = 0;
    source.readFile = (path: string) => {
      if (path === 'docs/guide.md') {
        guideReadCalls += 1;
        if (guideReadCalls === 1) return pendingGuideRead;
      }
      return originalReadFile(path);
    };

    source.emit('docs/guide.md'); // stuck awaiting pendingGuideRead

    // Widen the scope and let the config-triggered reload run to completion.
    source.files['.mos/config.json'] = JSON.stringify({
      specVersion: '0.4',
      wiki: { include: ['**/*.md'], exclude: [] },
      board: { include: ['board/**/*.md'], columns: [] },
      types: {},
    });
    source.emit('.mos/config.json');
    await service.load(); // coalesce onto + await the in-flight reload

    // The reload landed before the patch: widened scope is in effect and the
    // patch's content isn't there yet.
    expect(
      service
        .query({ q: 'aardvark', scope: 'wiki' })
        .map((h) => h.path)
        .sort(),
    ).toEqual(['board/T-100.md', 'docs/guide.md']);
    expect(service.query({ q: 'mongoose' })).toEqual([]);

    // Now let the stalled patch commit — it must build on the reload's
    // result, not clobber it back to the pre-reload, pre-widen state.
    resolveGuideRead('# Guide\n\nThe aardvark now meets a mongoose.');
    await flush();

    expect(service.query({ q: 'mongoose' }).map((h) => h.path)).toEqual(['docs/guide.md']);
    expect(
      service
        .query({ q: 'aardvark', scope: 'wiki' })
        .map((h) => h.path)
        .sort(),
    ).toEqual(['board/T-100.md', 'docs/guide.md']);
  });
});

/** Wait for a scheduled microtask/macrotask round after a `source.emit()` call. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
