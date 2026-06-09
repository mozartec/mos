import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { globToRegExp, loadConfig, parseFile, toPosixPath } from '@mos/core';
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

  /** Wiki-scope file paths, filtered by vault config. */
  protected readonly files = signal<string[]>([]);
  protected readonly selectedPath = signal<string | null>(null);
  protected readonly selectedBody = signal<string>('');

  /** Nested tree built from `files`. */
  protected readonly tree = computed(() => buildFileTree(this.files()));

  /** Keys (ancestry-path strings) of currently expanded folder nodes. */
  protected readonly expandedFolders = signal<ReadonlySet<string>>(new Set<string>());

  /** Flat, visibility-filtered list of tree entries for linear rendering. */
  protected readonly visibleEntries = computed(() =>
    flattenTree(this.tree(), this.expandedFolders()),
  );

  constructor() {
    void this.loadFiles();
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
      const includeGlobs = config.wiki.include.length > 0 ? config.wiki.include : ['**/*.md'];
      const excludeGlobs = config.wiki.exclude;
      const includeMatchers = includeGlobs.map(globToRegExp);
      const excludeMatchers = excludeGlobs.map(globToRegExp);

      const wikiFiles = allPaths.filter((p) => {
        const rel = toPosixPath(p);
        return (
          includeMatchers.some((re) => re.test(rel)) &&
          !excludeMatchers.some((re) => re.test(rel))
        );
      });

      this.files.set(wikiFiles);

      const firstFile = wikiFiles[0];
      if (firstFile) {
        void this.select(firstFile);
      }
    } catch (error: unknown) {
      console.error('Failed to load vault files', error);
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

  /** Track function for the flat entries list. */
  protected entryKey(_index: number, entry: FlatEntry): string {
    return entry.key;
  }
}
