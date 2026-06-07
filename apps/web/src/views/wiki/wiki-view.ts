import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';

/**
 * Empty Wiki view. It is fed by the injected {@link VaultSource} (it lists the
 * file paths) but renders no markdown yet — rendering arrives in F-003.
 */
@Component({
  selector: 'app-wiki-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wiki-view.html',
})
export class WikiView {
  private readonly source = inject(VAULT_SOURCE);
  protected readonly files = signal<string[]>([]);

  constructor() {
    void this.source.listFiles().then((files) => this.files.set(files));
  }
}
