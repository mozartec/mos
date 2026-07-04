import { Injectable, inject, signal } from '@angular/core';
import {
  buildSearchIndex,
  loadConfig,
  parseFile,
  querySearch,
  toPosixPath,
  type ParsedFile,
  type SearchHit,
  type SearchIndex,
  type SearchQuery,
  type VaultConfig,
} from '@mos/core';
import { VAULT_SOURCE } from '../sources/vault-source.token';

/**
 * One body-retaining read of the whole vault: the config, every vault-relative
 * path (for the wiki tree), and the successfully parsed files with their bodies
 * kept (for the model and the search index). {@link WikiView} builds its tree
 * and model from this same snapshot, so the vault is read once per entry — the
 * "hoist" the search prerequisite calls for (F-036-S-02).
 */
export interface VaultLoad {
  config: VaultConfig;
  /** Every vault-relative path (POSIX-normalised), including unparseable files. */
  paths: string[];
  /** Successfully parsed files, `body` retained, for the model and the index. */
  files: ParsedFile[];
}

/**
 * The full-text search engine's I/O host (F-036-S-02). It performs the one
 * unscoped `listFiles()` → `readFile` → `parseFile` pass that **keeps
 * `parsed.body`** — the gap the wiki left, since it reads the vault but drops
 * bodies — and hands the `ParsedFile[]` to the pure-core `buildSearchIndex`
 * (F-036-S-01). All matching, ranking, and snippet logic stays in core; this
 * service is I/O + the built index only (ADR-001, ADR-002).
 *
 * `providedIn: 'root'` so the wiki and any future search surface share it, but
 * it never reads on its own: only {@link WikiView} (or another search caller)
 * invokes {@link load}, so the board's initial load is untouched. The index is
 * rebuilt on every {@link load} — i.e. on each wiki entry — for v1; live,
 * per-change reindexing is F-036-S-04.
 */
@Injectable({ providedIn: 'root' })
export class SearchIndexService {
  private readonly source = inject(VAULT_SOURCE);

  /**
   * The built index, or `null` until the first load resolves. A rebuild keeps
   * the previous index in place until it succeeds (see {@link read}), so this is
   * only `null` before search has ever been ready.
   */
  private readonly _index = signal<SearchIndex | null>(null);

  /** `null` until the index is first built; a caller can show an honest loading state. */
  readonly index = this._index.asReadonly();

  /** Coalesces concurrent {@link load} calls onto one in-flight read. */
  private inFlight: Promise<VaultLoad> | null = null;

  /**
   * Read the whole vault (body-retaining) and rebuild the index. Concurrent
   * callers during one in-flight read share it; a later call reads afresh, so
   * re-entering the wiki rebuilds (F-036-S-02; live update is S-04). Rejects if
   * the source can't be listed — the caller surfaces the error.
   */
  load(): Promise<VaultLoad> {
    if (this.inFlight !== null) return this.inFlight;
    const read = this.read();
    this.inFlight = read;
    read
      .finally(() => {
        // Only clear if this read is still the current one, so a rebuild that
        // started after us isn't stranded by our completion.
        if (this.inFlight === read) this.inFlight = null;
      })
      .catch(() => {
        // The caller owns `read`'s rejection (they await the returned promise);
        // this cleanup-only chain must swallow it so a failed load isn't
        // reported as an unhandled rejection.
      });
    return read;
  }

  /**
   * Run a scoped query against the current index. Returns `[]` when the index
   * isn't built yet (the caller distinguishes "loading" via {@link index}) or
   * the query is empty — the ranking, folding, and snippets are all core's.
   */
  query(query: SearchQuery): SearchHit[] {
    const index = this._index();
    return index === null ? [] : querySearch(index, query);
  }

  private async read(): Promise<VaultLoad> {
    // Build into a local and swap the index only on success (the set below is
    // the sole writer). The first load has no index yet, so a query shows the
    // loading state until then; a rebuild keeps the previous index queryable
    // meanwhile — no flicker on re-entry — and a failed reload leaves the last
    // good index in place rather than blanking search.
    const [configText, rawPaths] = await Promise.all([
      this.source.readFile('.mos/config.json').catch(() => '{}'),
      this.source.listFiles(),
    ]);
    const { config } = loadConfig(configText);

    // POSIX-normalise before reading (like the board loader) so hit paths match
    // the wiki tree's paths and its `?path=` selection.
    const paths = rawPaths.map(toPosixPath);
    const parsed = await Promise.all(
      paths.map(async (path) => {
        try {
          return parseFile(path, await this.source.readFile(path));
        } catch {
          return null; // unreadable/unparseable — omit from the model and index
        }
      }),
    );
    const files = parsed.filter((file): file is ParsedFile => file !== null);

    this._index.set(buildSearchIndex(files, config));
    return { config, paths, files };
  }
}
