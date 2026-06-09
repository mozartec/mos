import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { buildModel, globToRegExp, loadConfig, parseFile, placeCard, sortWithinColumn, toPosixPath } from '@mos/core';
import type { Card, VaultConfig } from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { CardComponent } from '../../components/card/card';

/** Discriminated load state to drive the template honestly. */
type LoadState = 'loading' | 'loaded' | 'error';

/** One column on the board, with its name and sorted cards. */
export interface BoardColumn {
  name: string;
  cards: Card[];
}

/**
 * Sprint filter value: `null` = All, `''` = Backlog (cards with no sprint),
 * any other string = that sprint.
 */
export type SprintFilter = string | null;

/** Read a card's sprint from its frontmatter fields ('' when absent). */
export function cardSprint(card: Card): string {
  const value = card.fields['sprint'];
  return typeof value === 'string' ? value : '';
}

/**
 * Pure projection: narrow each column's cards to the selected sprint.
 * `null` returns the input unchanged; `''` keeps only cards with no sprint.
 */
export function filterColumnsBySprint(columns: BoardColumn[], filter: SprintFilter): BoardColumn[] {
  if (filter === null) return columns;
  return columns.map((col) => ({
    name: col.name,
    cards: col.cards.filter((card) => cardSprint(card) === filter),
  }));
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
  imports: [CardComponent],
  templateUrl: './board-view.html',
})
export class BoardView {
  private readonly source = inject(VAULT_SOURCE);

  /** Discriminated load state: drives the template to show loading / error / content. */
  protected readonly loadState = signal<LoadState>('loading');

  /** Full vault config loaded from source. */
  protected readonly config = signal<VaultConfig | null>(null);

  /** Unfiltered columns in config order, each with their sorted cards. */
  private readonly baseColumns = signal<BoardColumn[]>([]);

  /** Selected sprint filter: `null` = All, `''` = Backlog, else a sprint name. */
  protected readonly sprintFilter = signal<SprintFilter>(null);

  /** Sprint options for the selector, straight from config (ADR-003). */
  protected readonly sprintOptions = computed(() => this.config()?.sprints ?? []);

  /** Columns the template renders: the base columns narrowed by the sprint filter. */
  protected readonly columns = computed(() =>
    filterColumnsBySprint(this.baseColumns(), this.sprintFilter()),
  );

  /** Placement diagnostics for cards that couldn't be placed (unknown type/status). */
  protected readonly placementErrors = signal<string[]>([]);

  /** Message describing why the board failed to load, shown in the error state. */
  protected readonly loadError = signal<string>('');

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
      this.config.set(config);

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

      // Group cards into columns; collect placement errors so the user sees them.
      const columnMap = new Map<string, Card[]>(config.board.columns.map((col) => [col, []]));
      const errors: string[] = [];

      for (const card of Object.values(model.cards)) {
        const placement = placeCard(card, config);
        if (placement.error !== undefined) {
          errors.push(placement.error);
          continue;
        }
        if (placement.column === null) continue; // hidden-state card (Deferred/Dropped)
        const bucket = columnMap.get(placement.column);
        if (bucket) {
          bucket.push(card);
        }
      }
      this.placementErrors.set(errors);

      // Sort each column and assemble the final signal value.
      const sorted: BoardColumn[] = config.board.columns.map((name) => ({
        name,
        cards: sortWithinColumn(columnMap.get(name) ?? [], config),
      }));

      this.baseColumns.set(sorted);
      this.loadState.set('loaded');
    } catch (error: unknown) {
      this.loadError.set(error instanceof Error ? error.message : String(error));
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

  protected isCardBlocked(card: Card, config: VaultConfig): boolean {
    return placeCard(card, config).blocked;
  }

  /** Sentinel `<option>` values that can't collide with sprint names. */
  protected readonly ALL_VALUE = '__all__';
  protected readonly BACKLOG_VALUE = '__backlog__';

  /** The `<select>` value mirroring {@link sprintFilter}. */
  protected readonly sprintFilterValue = computed(() => {
    const filter = this.sprintFilter();
    if (filter === null) return this.ALL_VALUE;
    if (filter === '') return this.BACKLOG_VALUE;
    return filter;
  });

  protected onSprintFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === this.ALL_VALUE) this.sprintFilter.set(null);
    else if (value === this.BACKLOG_VALUE) this.sprintFilter.set('');
    else this.sprintFilter.set(value);
  }

  protected onCardSelect(card: Card): void {
    console.log('Selected card:', card.id);
  }
}
