import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';

/**
 * Empty Board view. It is fed by the injected {@link VaultSource} but applies no
 * board logic yet — columns and card placement arrive in F-004.
 */
@Component({
  selector: 'app-board-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-view.html',
})
export class BoardView {
  private readonly source = inject(VAULT_SOURCE);
  protected readonly files = signal<string[]>([]);

  constructor() {
    void this.source.listFiles().then((files) => this.files.set(files));
  }
}
