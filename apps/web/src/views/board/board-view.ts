import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { buildModel, globToRegExp, loadConfig, parseFile, placeCard, sortWithinColumn, toPosixPath } from '@mos/core';
import type { Card } from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';

/** Discriminated load state to drive the template honestly. */
type LoadState = 'loading' | 'loaded' | 'error';

/** One column on the board, with its name and sorted cards. */
export interface BoardColumn {
  name: string;
  cards: Card[];
}

/**
 * Board view. Loads the vault config and all board-scope files, builds the
 * VaultModel via core helpers, places each card in its config-driven column,
 * and sorts within columns by priority then id (F-004-S-01).
 *
 * The view is read-only — no drag targets, no move handlers (ADR-002).
 * Column set and order are config-driven — never hardcoded (ADR-003).
 */
@Component({
  selector: 'app-board-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-view.html',
})
export class BoardView {
  private readonly source = inject(VAULT_SOURCE);

  /** Discriminated load state: drives the template to show loading / error / content. */
  protected readonly loadState = signal<LoadState>('loading');

  /** Columns in config order, each with their sorted cards. */
  protected readonly columns = signal<BoardColumn[]>([]);

  constructor() {
    void this.loadBoard();
  }

  private async loadBoard(): Promise<void> {
    try {
      const [configText, allPaths] = await Promise.all([
        this.source.readFile('.mos/config.json').catch(() => '{}'),
        this.source.listFiles(),
      ]);

      const { config } = loadConfig(configText);

      // Pre-filter to board-scope paths before reading, so we don't fetch every
      // wiki/doc file — each readFile is a round-trip on a remote/HTTP source.
      const boardMatchers = config.board.include.map(globToRegExp);
      const boardPaths = allPaths
        .map(toPosixPath)
        .filter((p) => boardMatchers.some((re) => re.test(p)));

      // Read and parse only board-scope files.
      const parsedFiles = await Promise.all(
        boardPaths.map(async (posix) => {
          try {
            const text = await this.source.readFile(posix);
            return parseFile(posix, text);
          } catch {
            return null;
          }
        }),
      );

      const { model } = buildModel(
        parsedFiles.filter((f) => f !== null),
        config,
      );

      // Group cards into columns; place each card (guarded per constraint).
      const columnMap = new Map<string, Card[]>(config.board.columns.map((col) => [col, []]));

      for (const card of Object.values(model.cards)) {
        try {
          const placement = placeCard(card, config);
          if (placement.column === null) continue; // hidden-state card (Deferred/Dropped)
          const bucket = columnMap.get(placement.column);
          if (bucket) {
            bucket.push(card);
          }
        } catch (err: unknown) {
          // Bad card (unrecognized type/status): skip without crashing the board.
          console.error('Skipping unplaceable card', card.id, err);
        }
      }

      // Sort each column and assemble the final signal value.
      const sorted: BoardColumn[] = config.board.columns.map((name) => ({
        name,
        cards: sortWithinColumn(columnMap.get(name) ?? [], config),
      }));

      this.columns.set(sorted);
      this.loadState.set('loaded');
    } catch (error: unknown) {
      console.error('Failed to load board', error);
      this.loadState.set('error');
    }
  }

  /** Total visible card count across all columns. */
  protected readonly totalCards = computed(() =>
    this.columns().reduce((sum, col) => sum + col.cards.length, 0),
  );

  /** Track function for columns @for loop. */
  protected colTrack(_index: number, col: BoardColumn): string {
    return col.name;
  }

  /** Track function for cards @for loop. */
  protected cardTrack(_index: number, card: Card): string {
    return card.id;
  }
}
