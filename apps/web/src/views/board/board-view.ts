import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  applyFileChange,
  buildModel,
  createEmptyVaultModel,
  globToRegExp,
  loadConfig,
  parseFile,
  placeCard,
  sortWithinColumn,
  toPosixPath,
} from '@mos/core';
import type { Card, ParsedFile, VaultConfig, VaultModel } from '@mos/core';
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
 * URL form of the sprint filter: absent = All, present-but-empty (`?sprint=`)
 * = cards with no sprint (the Backlog option), anything else = that sprint
 * name. The empty string can never be a real sprint name, so no config-defined
 * sprint (not even one literally named "backlog") can collide with the sentinel.
 */
export function sprintFilterToParam(filter: SprintFilter): string | undefined {
  return filter === null ? undefined : filter;
}

export function paramToSprintFilter(param: string | null): SprintFilter {
  return param;
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Discriminated load state: drives the template to show loading / error / content. */
  protected readonly loadState = signal<LoadState>('loading');

  /** Full vault config loaded from source. */
  protected readonly config = signal<VaultConfig | null>(null);

  /** The board-scope vault model; live updates patch it incrementally (F-005-S-01). */
  private readonly model = signal<VaultModel>(createEmptyVaultModel());

  /** Selected sprint filter: `null` = All, `''` = Backlog, else a sprint name. */
  protected readonly sprintFilter = signal<SprintFilter>(null);

  /** Sprint options for the selector, straight from config (ADR-003). */
  protected readonly sprintOptions = computed(() => this.config()?.sprints ?? []);

  /**
   * Place every model card into its config-driven column (pure projection over
   * `model` + `config`, so live model patches re-place automatically).
   */
  private readonly placement = computed(() => {
    const config = this.config();
    if (config === null) return { columns: [] as BoardColumn[], errors: [] as string[] };

    const columnMap = new Map<string, Card[]>(config.board.columns.map((col) => [col, []]));
    const errors: string[] = [];

    for (const card of Object.values(this.model().cards)) {
      const placed = placeCard(card, config);
      if (placed.error !== undefined) {
        errors.push(placed.error);
        continue;
      }
      if (placed.column === null) continue; // hidden-state card (Deferred/Dropped)
      columnMap.get(placed.column)?.push(card);
    }

    const columns: BoardColumn[] = config.board.columns.map((name) => ({
      name,
      cards: sortWithinColumn(columnMap.get(name) ?? [], config),
    }));
    return { columns, errors };
  });

  /** Columns the template renders: placed columns narrowed by the sprint filter. */
  protected readonly columns = computed(() =>
    filterColumnsBySprint(this.placement().columns, this.sprintFilter()),
  );

  /** Placement diagnostics for cards that couldn't be placed (unknown type/status). */
  protected readonly placementErrors = computed(() => this.placement().errors);

  /** Message describing why the board failed to load, shown in the error state. */
  protected readonly loadError = signal<string>('');

  constructor() {
    // Restore the sprint filter from the URL so the board state is bookmarkable
    // and "back" from the reader lands on the same filtered board (F-004-S-04).
    this.sprintFilter.set(paramToSprintFilter(this.route.snapshot.queryParamMap.get('sprint')));
    void this.loadBoard();

    // Live re-index: react to vault changes while the board is open (F-005-S-01).
    const unwatch = this.source.watch((path) => void this.onFileChange(path));
    inject(DestroyRef).onDestroy(unwatch);
  }

  /** Re-parse just the changed file and patch the model; views react via signals. */
  private async onFileChange(path: string): Promise<void> {
    const config = this.config();
    if (config === null || this.loadState() !== 'loaded') return;

    const posix = toPosixPath(path);
    if (posix === '.mos/config.json') {
      // Config changes redefine columns/types — a full reload is the only safe move.
      void this.loadBoard();
      return;
    }

    const inBoardScope = config.board.include.map(globToRegExp).some((re) => re.test(posix));
    if (!inBoardScope) return;

    let parsed: ParsedFile | null;
    try {
      parsed = parseFile(posix, await this.source.readFile(posix));
    } catch {
      parsed = null; // unreadable = treat as deleted
    }
    this.model.set(applyFileChange(this.model(), config, posix, parsed).model);
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

      this.model.set(model);
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

    // Mirror the filter into the URL (no history entry per keystroke-y change).
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sprint: sprintFilterToParam(this.sprintFilter()) ?? null },
      replaceUrl: true,
    });
  }

  /** Open the card's file in the shared reader, carrying the way back (ADR-004). */
  protected onCardSelect(card: Card): void {
    void this.router.navigate(['/reader'], {
      queryParams: {
        path: card.path,
        from: 'board',
        sprint: sprintFilterToParam(this.sprintFilter()),
      },
    });
  }
}
