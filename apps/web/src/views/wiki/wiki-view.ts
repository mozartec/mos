import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  QueryList,
  ViewChildren,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  applyFileChange,
  globToRegExp,
  loadConfig,
  parseFile,
  toPosixPath,
  createEmptyVaultModel,
  buildModel,
  type ParsedFile,
  type SearchHit,
  type SearchScopeFilter,
  type VaultModel,
  type VaultConfig,
} from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { SearchIndexService } from '../../services/search-index-service';
import { MarkdownReader } from '../../components/markdown-reader/markdown-reader';
import { buildFileTree, flattenTree } from './file-tree';
import type { FlatEntry } from './file-tree';

/**
 * Wiki view. Loads the whole vault once through the {@link SearchIndexService}
 * (a body-retaining read shared with full-text search), filters the paths
 * through the vault config's `wiki.include`/`exclude` globs, renders the result
 * as a collapsible folder tree, and displays the selected file's body via
 * {@link MarkdownReader}.
 *
 * A search box above the tree turns the sidebar into scoped, snippet-highlighted
 * results while a `?q=` query is active; clearing it restores the tree. Query
 * and scope live in the URL (`?q=&in=`), so a search is bookmarkable (ADR-004);
 * selecting a result opens the file in place via the same `?path=` selection
 * (F-036-S-02).
 */
@Component({
  selector: 'app-wiki-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownReader],
  templateUrl: './wiki-view.html',
})
export class WikiView {
  private readonly source = inject(VAULT_SOURCE);
  private readonly searchIndex = inject(SearchIndexService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Wiki-scope file paths (POSIX-normalised), filtered by vault config. */
  protected readonly files = signal<string[]>([]);

  /** Message describing why the wiki failed to load, shown in the error state. */
  protected readonly loadError = signal<string>('');
  protected readonly selectedPath = signal<string | null>(null);
  protected readonly selectedBody = signal<string>('');

  protected readonly config = signal<VaultConfig>(loadConfig('{}').config);
  protected readonly model = signal<VaultModel>(createEmptyVaultModel());

  /** Nested tree built from `files`. */
  protected readonly tree = computed(() => buildFileTree(this.files()));

  /** Keys (ancestry-path strings) of currently expanded folder nodes. */
  protected readonly expandedFolders = signal<ReadonlySet<string>>(new Set<string>());

  /** Flat, visibility-filtered list of tree entries for linear rendering. */
  protected readonly visibleEntries = computed(() =>
    flattenTree(this.tree(), this.expandedFolders()),
  );

  /** Index of the treeitem that currently owns tabindex="0" (roving tabindex). */
  protected readonly focusedIndex = signal<number>(0);

  @ViewChildren('treeItem') treeItems!: QueryList<ElementRef<HTMLElement>>;

  // ── Search (F-036-S-02) ──────────────────────────────────────────────────

  /** The scope segmented control's options, in display order. */
  protected readonly scopeOptions: readonly { value: SearchScopeFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'wiki', label: 'Wiki' },
    { value: 'board', label: 'Board' },
  ];

  /** The active query, from `?q=` — the single source of truth (ADR-004). */
  protected readonly searchQuery = computed(() => this.queryParams().get('q') ?? '');

  /** The active scope filter, from `?in=`; anything but wiki/board means All. */
  protected readonly searchScope = computed<SearchScopeFilter>(() => {
    const raw = this.queryParams().get('in');
    return raw === 'wiki' || raw === 'board' ? raw : 'all';
  });

  /** True while a (non-blank) query is active — the sidebar shows results, not the tree. */
  protected readonly isSearching = computed(() => this.searchQuery().trim() !== '');

  /** False until the body index has finished building — drives the loading state. */
  protected readonly searchReady = computed(() => this.searchIndex.index() !== null);

  /** Scoped, ranked hits for the active query (empty when not searching). */
  protected readonly results = computed<SearchHit[]>(() =>
    this.isSearching()
      ? this.searchIndex.query({ q: this.searchQuery(), scope: this.searchScope() })
      : [],
  );

  /** Result count, announced via `aria-live` and shown in the sidebar. */
  protected readonly resultCount = computed(() => this.results().length);

  /** Render-ready results: base name + a one-line, `<mark>`-able snippet. */
  protected readonly resultViews = computed<ResultView[]>(() =>
    this.results().map((hit) => toResultView(hit)),
  );

  /** Index of the active option in the results listbox (combobox `activedescendant`). */
  protected readonly activeResult = signal<number>(0);

  /**
   * The active option's element id, or `null` when there's nothing to point at.
   * Bounded on both ends: an out-of-range `activeResult` (e.g. a Back/Forward
   * that shrinks the result set) must not emit an `aria-activedescendant` that
   * references an option that isn't rendered.
   */
  protected readonly activeDescendant = computed<string | null>(() =>
    this.isSearching() && this.activeResult() >= 0 && this.activeResult() < this.results().length
      ? this.optionId(this.activeResult())
      : null,
  );

  @ViewChildren('resultOption') resultOptions!: QueryList<ElementRef<HTMLElement>>;

  /**
   * Screen-reader status announced when a result opens the reader in place —
   * focus deliberately stays in the search box (the Obsidian model), so an
   * `aria-live` message is the only signal a document changed (WCAG 4.1.3).
   */
  protected readonly openedAnnouncement = signal<string>('');

  constructor() {
    void this.loadFiles();

    // Keep the active result in range as the result set changes. Reset to the
    // first hit whenever `results()` changes identity — a new query/scope, the
    // index finishing, or a Back/Forward that rewrites `?q=`/`?in=` straight
    // through the URL (bypassing the input handlers). Without this an out-of-
    // range `activeResult` would point `aria-activedescendant` at a missing
    // option and make Enter a no-op over a visibly populated list.
    effect(() => {
      this.results();
      this.activeResult.set(0);
    });

    // The `path` query param is the navigable selection (F-017): link clicks
    // push it, the browser's back/forward pops it, and this effect follows it.
    effect(() => {
      const routed = this.queryParams().get('path');
      if (routed !== null && routed !== this.selectedPath()) void this.select(routed);
    });

    // Live re-index: re-parse only the changed file and patch the model (F-005-S-01).
    const unwatch = this.source.watch((path) => void this.onFileChange(path));
    inject(DestroyRef).onDestroy(unwatch);
  }

  /** Tree click: swap the file without growing history (as before F-017). */
  protected openFromTree(path: string): void {
    void this.select(path);
    this.syncPathParam(path, { push: false });
  }

  /**
   * Internal link click from the reader: push a history entry so the
   * browser's back button returns to the source page (F-017).
   */
  protected openFromLink(path: string): void {
    this.syncPathParam(path, { push: true });
  }

  private syncPathParam(path: string, opts: { push: boolean }): void {
    this.mergeParams({ path }, opts);
  }

  /**
   * Merge query params onto the current URL (single source of truth, ADR-004).
   * Replaces by default so selection/search churn doesn't grow history; a `push`
   * leaves an entry for the browser back button (in-reader link clicks, F-017).
   */
  private mergeParams(
    params: Record<string, string | null>,
    opts: { push: boolean } = { push: false },
  ): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: !opts.push,
    });
  }

  // ── Search (F-036-S-02) ──────────────────────────────────────────────────

  // `activeResult` is reset to the first hit by the results-change effect, so
  // these handlers only own their URL write.

  /** Query-box input: write `?q=` (dropping it when blank). */
  protected onQueryInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.mergeParams({ q: q === '' ? null : q });
  }

  /** Scope pick: write `?in=` (All is the default, so it drops the param). */
  protected setSearchScope(scope: SearchScopeFilter): void {
    this.mergeParams({ in: scope === 'all' ? null : scope });
  }

  /** Clear the query (Esc / Clear) — the sidebar falls back to the file tree. */
  protected clearSearch(): void {
    this.mergeParams({ q: null });
  }

  /**
   * Open a result in place: merge `?path=` (keeping `?q=`/`?in=`) so the file
   * shows in the content pane while the sidebar stays on the results, and the
   * carried `q` lets the in-document highlighter light it up (F-036-S-03). The
   * existing `?path=` effect performs the selection; replace, not push — picking
   * from the list is a selection, like a tree click. Focus stays in the search
   * box, so announce the open for screen readers (WCAG 4.1.3).
   */
  protected openResult(hit: SearchHit): void {
    this.mergeParams({ path: hit.path });
    this.openedAnnouncement.set(`Opened ${baseName(hit.path)}`);
  }

  /** Element id for the option at `index` (combobox `aria-activedescendant`). */
  protected optionId(index: number): string {
    return `wiki-search-option-${index}`;
  }

  /**
   * Combobox keyboard model (focus stays on the input; the active option is
   * tracked via `aria-activedescendant`): Down/Up move, Enter opens, Esc clears.
   */
  protected onSearchKeydown(event: KeyboardEvent): void {
    const results = this.results();
    switch (event.key) {
      case 'ArrowDown':
        if (results.length === 0) return;
        event.preventDefault();
        this.activeResult.update((i) => Math.min(i + 1, results.length - 1));
        this.scrollActiveIntoView();
        break;
      case 'ArrowUp':
        if (results.length === 0) return;
        event.preventDefault();
        this.activeResult.update((i) => Math.max(i - 1, 0));
        this.scrollActiveIntoView();
        break;
      case 'Enter': {
        const hit = results[this.activeResult()];
        if (hit) {
          event.preventDefault();
          this.openResult(hit);
        }
        break;
      }
      case 'Escape':
        if (this.isSearching()) {
          event.preventDefault();
          this.clearSearch();
        }
        break;
      default:
        break;
    }
  }

  /** Keep the active option visible as arrow keys walk a long results list. */
  private scrollActiveIntoView(): void {
    const index = this.activeResult();
    afterNextRender(
      // Optional call: jsdom (unit tests) has no scrollIntoView, and its absence
      // is a harmless no-op rather than a thrown error in the render callback.
      () =>
        this.resultOptions?.toArray()[index]?.nativeElement.scrollIntoView?.({ block: 'nearest' }),
      { injector: this.injector },
    );
  }

  /** Patch the model and tree for one changed file; refresh the open reader. */
  private async onFileChange(path: string): Promise<void> {
    const posix = toPosixPath(path);
    if (posix === '.mos/config.json') {
      // Config changes redefine wiki scope — reload everything.
      void this.loadFiles();
      return;
    }

    const config = this.config();
    let parsed: ParsedFile | null;
    try {
      parsed = parseFile(posix, await this.source.readFile(posix));
    } catch {
      parsed = null; // unreadable = treat as deleted
    }

    // Patch the reference-resolution model incrementally.
    this.model.set(applyFileChange(this.model(), config, posix, parsed).model);

    // Keep the tree listing in sync (same include/exclude rules as loadFiles).
    const includeGlobs = config.wiki.include.length > 0 ? config.wiki.include : ['**/*.md'];
    const inWikiScope =
      parsed !== null &&
      includeGlobs.map(globToRegExp).some((re) => re.test(posix)) &&
      !config.wiki.exclude.map(globToRegExp).some((re) => re.test(posix));
    this.files.update((files) => {
      const present = files.includes(posix);
      if (inWikiScope && !present) return [...files, posix];
      if (!inWikiScope && present) return files.filter((f) => f !== posix);
      return files;
    });

    // Re-render the open file without a manual refresh (F-005).
    if (this.selectedPath() === posix) {
      this.selectedBody.set(parsed?.body ?? '');
    }
  }

  private async loadFiles(): Promise<void> {
    try {
      // Clear any prior error so a recovered reload (e.g. after a transient
      // read failure) doesn't leave a stale banner up.
      this.loadError.set('');

      // One body-retaining read of the whole vault, shared with full-text
      // search (F-036-S-02): the service does the listFiles → readFile →
      // parseFile pass and builds the index; the wiki derives its tree + model
      // from the same snapshot, so the vault is read once per entry.
      const { config, paths, files } = await this.searchIndex.load();
      this.config.set(config);

      // Build the VaultModel from the parsed files (reference resolution, the
      // reader). Unreadable/unparseable files were already dropped by the
      // loader, so a single bad file degrades to a missing entry (T-007).
      const { model } = buildModel(files, config);
      this.model.set(model);

      // Apply wiki.include / wiki.exclude filtering from the vault config.
      // Falls back to showing all .md files when the config is absent or empty.
      const includeGlobs = config.wiki.include.length > 0 ? config.wiki.include : ['**/*.md'];
      const includeMatchers = includeGlobs.map(globToRegExp);
      const excludeMatchers = config.wiki.exclude.map(globToRegExp);

      // Paths arrive POSIX-normalised from the loader.
      const wikiFiles = paths.filter(
        (rel) =>
          includeMatchers.some((re) => re.test(rel)) && !excludeMatchers.some((re) => re.test(rel)),
      );

      this.files.set(wikiFiles);

      // A `path` query param deep-links a file (F-017); otherwise open the
      // first wiki file. Seeding the URL (replace, not push) gives the first
      // in-reader link click a history entry to come back to. When arriving with
      // an active search but no explicit path, don't auto-open an arbitrary file:
      // that would mutate a search-only bookmark (adding `?path=`) and show a doc
      // unrelated to the query — let the user pick from the results instead.
      const routedPath = this.queryParams().get('path');
      const initialFile = routedPath ?? (this.isSearching() ? undefined : wikiFiles[0]);
      if (initialFile) {
        // Seed expanded folders so the initial file's row is visible and highlighted on load.
        const ancestors = getAncestorKeys(initialFile);
        if (ancestors.length > 0) {
          this.expandedFolders.set(new Set(ancestors));
        }
        void this.select(initialFile);
        this.syncPathParam(initialFile, { push: false });
      }
    } catch (error: unknown) {
      // Surface the miss visibly instead of rendering an empty tree (T-007).
      this.loadError.set(error instanceof Error ? error.message : String(error));
    }
  }

  protected toggleFolder(key: string): void {
    this.expandedFolders.update((set) => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  protected async select(path: string): Promise<void> {
    this.selectedPath.set(path);
    try {
      const text = await this.source.readFile(path);
      // A newer selection may have won the race while this read was in flight;
      // bail rather than overwrite the current file's body with stale content.
      if (this.selectedPath() !== path) return;
      const parsed = parseFile(path, text);
      this.selectedBody.set(parsed.body);
    } catch (error: unknown) {
      console.error(`Failed to read markdown file "${path}"`, error);
      if (this.selectedPath() !== path) return;
      this.selectedBody.set('');
    }
  }

  /**
   * Keyboard navigation for the WAI-ARIA tree pattern (roving tabindex).
   *
   * - ArrowDown / ArrowUp: move focus to next / previous visible entry.
   * - Home / End: move focus to first / last entry.
   * - ArrowRight: expand collapsed folder (and enter it); enter expanded folder.
   * - ArrowLeft: collapse expanded folder; move to parent for files / collapsed folders.
   */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    const entries = this.visibleEntries();
    let newIndex = index;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        newIndex = Math.min(index + 1, entries.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        newIndex = Math.max(index - 1, 0);
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = entries.length - 1;
        break;
      case 'ArrowRight': {
        event.preventDefault();
        const entry = entries[index];
        if (entry?.kind === 'folder') {
          if (!this.expandedFolders().has(entry.key)) {
            this.toggleFolder(entry.key);
          }
          // Move into first child (re-read after possible expansion).
          newIndex = Math.min(index + 1, this.visibleEntries().length - 1);
        }
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        const entry = entries[index];
        if (entry?.kind === 'folder' && this.expandedFolders().has(entry.key)) {
          this.toggleFolder(entry.key);
          newIndex = index;
        } else if (entry && entry.depth > 0) {
          // Move to the nearest ancestor folder at depth - 1.
          for (let i = index - 1; i >= 0; i--) {
            const candidate = entries[i];
            if (candidate?.kind === 'folder' && candidate.depth === entry.depth - 1) {
              newIndex = i;
              break;
            }
          }
        }
        break;
      }
      default:
        return;
    }

    this.moveFocus(newIndex);
  }

  private moveFocus(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.visibleEntries().length - 1));
    this.focusedIndex.set(clamped);
    // Lifecycle-bound (unlike a bare setTimeout): skipped if the view is
    // destroyed before the next render.
    afterNextRender(() => this.treeItems.toArray()[clamped]?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  /** Track function for the flat entries list. */
  protected entryKey(_index: number, entry: FlatEntry): string {
    return entry.key;
  }
}

/** A render-ready search result: the file's base name and a one-line snippet. */
interface ResultView {
  readonly hit: SearchHit;
  /** Full vault-relative path, e.g. `docs/01-VISION.md` — the option's stable track key. */
  readonly path: string;
  /** Base name (last path segment) shown as the result's title. */
  readonly name: string;
  /** Whitespace-collapsed context before the match, with a leading `…` when trimmed. */
  readonly before: string;
  /** The matched source text, wrapped in `<mark>`. */
  readonly match: string;
  /** Whitespace-collapsed context after the match (a trailing `…` is the CSS truncation). */
  readonly after: string;
  /** True for a title-only hit (no body snippet). */
  readonly titleOnly: boolean;
}

/** Project one core {@link SearchHit} into its one-line, `<mark>`-able view. */
function toResultView(hit: SearchHit): ResultView {
  const snippet = hit.snippet;
  const before = snippet ? collapseWhitespace(snippet.before) : '';
  // `before` is `body.slice(clampedStart, start)`, so it's shorter than `start`
  // exactly when the radius window trimmed earlier body text — flag that with a
  // leading ellipsis. (A trailing one isn't needed: CSS truncation shows it.)
  const trimmedBefore = snippet !== null && snippet.start > snippet.before.length;
  return {
    hit,
    path: hit.path,
    name: baseName(hit.path),
    before: trimmedBefore ? `…${before}` : before,
    match: snippet ? snippet.match : '',
    after: snippet ? collapseWhitespace(snippet.after) : '',
    titleOnly: snippet === null,
  };
}

/** The last segment of a POSIX path, e.g. `docs/a/b.md` → `b.md`. */
function baseName(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? path : path.slice(slash + 1);
}

/** Collapse runs of whitespace (incl. newlines) to single spaces for a one-liner. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/** Returns the slash-joined ancestor folder keys for a vault-relative file path. */
function getAncestorKeys(filePath: string): string[] {
  const parts = filePath.split('/');
  parts.pop(); // remove filename
  const keys: string[] = [];
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    keys.push(current);
  }
  return keys;
}
