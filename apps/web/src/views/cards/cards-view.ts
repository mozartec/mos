import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  applyFileChange,
  applyFilters,
  buildFacets,
  buildModel,
  childrenProgress,
  containerIds,
  createEmptyVaultModel,
  globToRegExp,
  loadConfig,
  parseFile,
  placeCard,
  toPosixPath,
} from '@mos/core';
import type {
  Card,
  ChildrenProgress,
  Facet,
  FilterState,
  ParsedFile,
  VaultConfig,
  VaultModel,
} from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { CardPeek } from '../../components/card-peek/card-peek';
import { FilterBar } from '../../components/filter-bar/filter-bar';
import { badgeClassFor } from '../../components/card/card-style';
import { buildRenderFields, type RenderField } from '../../components/card/card-fields';
import {
  buildCardsColumns,
  parseSort,
  serializeSort,
  sortCards,
  type CardsColumn,
  type SortState,
} from './cards-columns';

/** Discriminated load state to drive the template honestly. */
type LoadState = 'loading' | 'loaded' | 'error';

/** One table row: the card plus its pre-rendered cells and container progress. */
export interface CardsRow {
  card: Card;
  /** Face-field cells keyed by field name; a field the type omits is absent. */
  cells: Record<string, RenderField>;
  /** Children-progress for a container row (F-022), `null` for leaves. */
  progress: ChildrenProgress | null;
}

/**
 * URL query keys this view owns (sort + peek + reader plumbing). A facet whose
 * field name collides with one of these is dropped, same guard as the board's
 * (F-023). Unlike the board, `scope` is *not* reserved here — the Cards lens
 * has no scope switcher, so the scope field arrives as a plain facet under its
 * own field name (never the literal key `scope`).
 */
const RESERVED_URL_KEYS = new Set(['q', 'path', 'from', 'peek', 'sort']);

/**
 * Cards lens (F-020, ADR-018): the flat, filterable index of every card in the
 * vault — the "show me everything" view the board deliberately isn't. One
 * dense, sortable table whose columns derive from the config's fields registry
 * and type definitions (ADR-003), under the same shared filter bar as the
 * board/backlog (one filter bar — F-023) extended with status/scope facets.
 * Filters, sort, and the side peek all live in the URL, so any table state is
 * bookmarkable (ADR-004). Read-only (ADR-002): sorting/filtering are computed
 * here over the loaded vault model — no new endpoints.
 */
@Component({
  selector: 'app-cards-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPeek, FilterBar],
  templateUrl: './cards-view.html',
})
export class CardsView {
  private readonly source = inject(VAULT_SOURCE);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Discriminated load state: drives the template to show loading / error / content. */
  protected readonly loadState = signal<LoadState>('loading');

  /** Full vault config loaded from source. */
  protected readonly config = signal<VaultConfig | null>(null);

  /** The board-scope vault model; live updates patch it incrementally (F-005-S-01). */
  private readonly model = signal<VaultModel>(createEmptyVaultModel());

  /** Read-only view of the model, handed to the side peek for its relations. */
  protected readonly peekModel = this.model.asReadonly();

  /** Message describing why the view failed to load, shown in the error state. */
  protected readonly loadError = signal<string>('');

  /** URL query params; filter + sort + peek state derive from here (single source). */
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** The id of the card to open in the side peek, from `?peek=` (F-021-S-03). */
  protected readonly peekId = computed(() => this.queryParams().get('peek'));

  /** Every card in the model. */
  private readonly allCards = computed(() => Object.values(this.model().cards));

  /** Ids other cards name as `parent` — container rows get a progress chip (F-022). */
  private readonly containers = computed<Set<string>>(() => containerIds(this.model()));

  /**
   * Filter facets: the board's config-driven set plus the status and scope
   * facets this lens opts into (nothing hardcoded; ADR-003). One filter bar —
   * the capability lives in core's `buildFacets`, shared with board/backlog.
   */
  protected readonly facets = computed<Facet[]>(() => {
    const config = this.config();
    if (config === null) return [];
    return buildFacets(config, this.allCards(), { status: true, scope: true }).filter(
      (facet) => !RESERVED_URL_KEYS.has(facet.field),
    );
  });

  /** Current filter selection, read from the URL (same contract as the board). */
  protected readonly filterState = computed<FilterState>(() => {
    const params = this.queryParams();
    const facetFields = new Set(this.facets().map((facet) => facet.field));
    const values: Record<string, string> = {};
    for (const key of params.keys) {
      if (!facetFields.has(key)) continue;
      const value = params.get(key);
      if (value) values[key] = value;
    }
    return { q: params.get('q') ?? '', values };
  });

  /** The current sort, from `?sort=` (`-field` = descending). */
  protected readonly sort = computed<SortState>(() => parseSort(this.queryParams().get('sort')));

  /** Table columns, derived from the config — never a hardcoded list (ADR-003). */
  protected readonly columns = computed<CardsColumn[]>(() => {
    const config = this.config();
    return config === null ? [] : buildCardsColumns(config);
  });

  /** Every card, narrowed by the filters and ordered by the current sort. */
  private readonly results = computed<Card[]>(() => {
    const config = this.config();
    if (config === null) return [];
    return sortCards(
      applyFilters(this.allCards(), this.filterState(), config),
      this.sort(),
      config,
    );
  });

  /** The rows the table renders: cards with pre-rendered face-field cells. */
  protected readonly rows = computed<CardsRow[]>(() => {
    const config = this.config();
    if (config === null) return [];
    const model = this.model();
    const containers = this.containers();
    return this.results().map((card) => {
      const typeDef = config.types[card.type];
      const cells: Record<string, RenderField> = {};
      if (typeDef !== undefined) {
        for (const field of buildRenderFields(card, typeDef, config.fields)) {
          cells[field.key] = field;
        }
      }
      return {
        card,
        cells,
        progress: containers.has(card.id) ? childrenProgress(model, config, card.id) : null,
      };
    });
  });

  /** Monotonic token: a newer loadCards() invalidates an older one's writes. */
  private loadSeq = 0;

  constructor() {
    void this.loadCards();

    // Live re-index: react to vault changes while the table is open (F-005-S-01).
    const unwatch = this.source.watch((path) => void this.onFileChange(path));
    inject(DestroyRef).onDestroy(unwatch);
  }

  /** Re-parse just the changed file and patch the model; the table reacts via signals. */
  private async onFileChange(path: string): Promise<void> {
    const config = this.config();
    if (config === null || this.loadState() !== 'loaded') return;

    const posix = toPosixPath(path);
    if (posix === '.mos/config.json') {
      // Config changes redefine columns/types/facets — a full reload is safest.
      void this.loadCards();
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

  private async loadCards(): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const [configText, allPaths] = await Promise.all([
        this.source.readFile('.mos/config.json').catch(() => '{}'),
        this.source.listFiles(),
      ]);
      if (seq !== this.loadSeq) return; // superseded by a newer reload

      const { config } = loadConfig(configText);
      this.config.set(config);

      // Pre-filter to board-scope paths before reading, so we don't fetch every
      // wiki/doc file — each readFile is a round-trip on a remote/HTTP source.
      const boardMatchers = config.board.include.map(globToRegExp);
      const boardPaths = allPaths
        .map(toPosixPath)
        .filter((p) => boardMatchers.some((re) => re.test(p)));

      const parsedFiles = await Promise.all(
        boardPaths.map(async (posix) => {
          try {
            return parseFile(posix, await this.source.readFile(posix));
          } catch {
            return null;
          }
        }),
      );
      // Two quick config saves race their reloads: without this check, the
      // slower stale read could land last and pin the table to the old config.
      if (seq !== this.loadSeq) return;

      const { model } = buildModel(
        parsedFiles.filter((f) => f !== null),
        config,
      );

      this.model.set(model);
      this.loadState.set('loaded');
    } catch (error: unknown) {
      if (seq !== this.loadSeq) return;
      this.loadError.set(error instanceof Error ? error.message : String(error));
      this.loadState.set('error');
    }
  }

  /** Track function for rows. */
  protected rowTrack(_index: number, row: CardsRow): string {
    return row.card.id;
  }

  /** Type badge classes from the type's configured color, as on board cards. */
  protected typeBadgeClass(card: Card): string {
    return `border ${badgeClassFor(this.config()?.types[card.type]?.color)}`;
  }

  /** The type's configured label, else the raw type name. */
  protected typeLabel(card: Card): string {
    return this.config()?.types[card.type]?.label ?? card.type;
  }

  /** Status chip tone: the blocked alert tone, else a quiet soft badge. */
  protected statusBadgeClass(card: Card): string {
    const config = this.config();
    return config !== null && placeCard(card, config).blocked ? 'badge-error' : 'badge-soft';
  }

  // ── Sorting ─────────────────────────────────────────────────────────────────

  /** Click a header: sort by it; a second click flips the direction. */
  protected onSort(field: string): void {
    const current = this.sort();
    const next: SortState =
      current.field === field ? { field, desc: !current.desc } : { field, desc: false };
    this.mergeParams({ sort: serializeSort(next) });
  }

  /** `aria-sort` for a header: only the active sort column carries one. */
  protected ariaSort(field: string): 'ascending' | 'descending' | null {
    const sort = this.sort();
    if (sort.field !== field) return null;
    return sort.desc ? 'descending' : 'ascending';
  }

  // ── Filters ─────────────────────────────────────────────────────────────────

  protected onFilterChange(next: FilterState): void {
    const params: Record<string, string | null> = { q: next.q.trim() === '' ? null : next.q };
    // Null out every facet field, then set the selected ones, so cleared
    // facets leave the URL.
    for (const facet of this.facets()) params[facet.field] = next.values[facet.field] ?? null;
    this.mergeParams(params);
  }

  private mergeParams(params: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ── Side peek (F-021-S-03): rows open cards exactly like board cards do ─────

  /** Clicking a row (or its id control) opens the card in the side peek. */
  protected onRowSelect(card: Card): void {
    this.openPeek(card.id);
  }

  /** Open a card in the peek by pushing `?peek=`, so browser back closes it. */
  protected openPeek(id: string): void {
    this.navigatePeek(id, false);
  }

  /** Swap the peek to a related card by replacing `?peek=` (one history entry). */
  protected swapPeek(id: string): void {
    this.navigatePeek(id, true);
  }

  /** Close the peek by dropping `?peek=` (replace — no extra history entry). */
  protected closePeek(): void {
    this.navigatePeek(null, true);
  }

  private navigatePeek(peek: string | null, replaceUrl: boolean): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { peek },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  /** Expand the peek to the full card page, carrying table state for "back". */
  protected expandPeek(id: string): void {
    void this.router.navigate(['/card', id], { queryParams: this.carryState() });
  }

  /** Leave the peek for a wiki doc in the reader, carrying table state for "back". */
  protected openDoc(path: string): void {
    void this.router.navigate(['/reader'], { queryParams: { ...this.carryState(), path } });
  }

  /**
   * The table's URL state (filters + sort) tagged with `from: 'cards'`, minus
   * the peek param — what the card page or reader needs to restore "back" to
   * this exact table (the contract the board established).
   */
  private carryState(): Record<string, string> {
    const params: Record<string, string> = {};
    const current = this.queryParams();
    for (const key of current.keys) {
      if (key === 'peek') continue;
      const value = current.get(key);
      if (value !== null) params[key] = value;
    }
    params['from'] = 'cards';
    return params;
  }
}
