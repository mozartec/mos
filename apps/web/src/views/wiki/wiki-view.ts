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
  inject,
  signal,
} from '@angular/core';
import {
  applyFileChange,
  globToRegExp,
  loadConfig,
  parseFile,
  toPosixPath,
  createEmptyVaultModel,
  buildModel,
  type ParsedFile,
  type VaultModel,
  type VaultConfig,
} from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { MarkdownReader } from '../../components/markdown-reader/markdown-reader';
import { buildFileTree, flattenTree } from './file-tree';
import type { FlatEntry } from './file-tree';

/**
 * Wiki view. Loads wiki-scope file paths from the injected {@link VaultSource},
 * filters them through the vault config's `wiki.include`/`exclude` globs,
 * renders the result as a collapsible folder tree, and displays the selected
 * file's body via {@link MarkdownReader}.
 */
@Component({
  selector: 'app-wiki-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownReader],
  templateUrl: './wiki-view.html',
})
export class WikiView {
  private readonly source = inject(VAULT_SOURCE);
  private readonly injector = inject(Injector);

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

  constructor() {
    void this.loadFiles();

    // Live re-index: re-parse only the changed file and patch the model (F-005-S-01).
    const unwatch = this.source.watch((path) => void this.onFileChange(path));
    inject(DestroyRef).onDestroy(unwatch);
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
      const [configText, allPaths] = await Promise.all([
        this.source.readFile('.mos/config.json').catch(() => '{}'),
        this.source.listFiles(),
      ]);

      // Apply wiki.include / wiki.exclude filtering from the vault config.
      // Falls back to showing all .md files when the config is absent or empty.
      const { config } = loadConfig(configText);
      this.config.set(config);

      // Read and parse all files to build the VaultModel. Guard per file so a
      // single unreadable/unparseable file degrades to a missing entry instead
      // of blanking the whole wiki (T-007).
      const allParsedFiles = await Promise.all(
        allPaths.map(async (path) => {
          try {
            return parseFile(path, await this.source.readFile(path));
          } catch {
            return null;
          }
        }),
      );
      const { model } = buildModel(
        allParsedFiles.filter((f) => f !== null),
        config,
      );
      this.model.set(model);

      const includeGlobs = config.wiki.include.length > 0 ? config.wiki.include : ['**/*.md'];
      const excludeGlobs = config.wiki.exclude;
      const includeMatchers = includeGlobs.map(globToRegExp);
      const excludeMatchers = excludeGlobs.map(globToRegExp);

      // Normalize to POSIX paths before filtering and storing.
      const wikiFiles = allPaths
        .map(toPosixPath)
        .filter((rel) => {
          return (
            includeMatchers.some((re) => re.test(rel)) &&
            !excludeMatchers.some((re) => re.test(rel))
          );
        });

      this.files.set(wikiFiles);

      const firstFile = wikiFiles[0];
      if (firstFile) {
        // Seed expanded folders so the first file's row is visible and highlighted on load.
        const ancestors = getAncestorKeys(firstFile);
        if (ancestors.length > 0) {
          this.expandedFolders.set(new Set(ancestors));
        }
        void this.select(firstFile);
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
