import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { parseFile } from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { MarkdownReader } from '../../components/markdown-reader/markdown-reader';

/**
 * Wiki view. Lists vault file paths from the injected {@link VaultSource} and
 * renders the selected file's body as sanitized HTML via {@link MarkdownReader}.
 */
@Component({
  selector: 'app-wiki-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownReader],
  templateUrl: './wiki-view.html',
})
export class WikiView {
  private readonly source = inject(VAULT_SOURCE);
  protected readonly files = signal<string[]>([]);
  protected readonly selectedPath = signal<string | null>(null);
  protected readonly selectedBody = signal<string>('');

  constructor() {
    this.source
      .listFiles()
      .then((files) => {
        this.files.set(files);
        const firstFile = files[0];
        if (firstFile) {
          void this.select(firstFile);
        }
      })
      .catch((error: unknown) => {
        // A source can reject (a future HTTP/Tauri source far more readily than
        // the static stub). Leave the file list empty rather than letting the
        // rejection float unhandled.
        console.error('Failed to list vault files', error);
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
}
