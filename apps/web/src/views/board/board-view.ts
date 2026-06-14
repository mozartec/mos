import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  applyFileChange,
  applyFilters,
  backlogCards,
  buildFacets,
  buildModel,
  cardScopeValue,
  createEmptyVaultModel,
  globToRegExp,
  inFlightCollisions,
  loadConfig,
  normalizeScope,
  parseFile,
  placeCard,
  resolveCurrentScope,
  safeToStart,
  scopeDaysLeft,
  sortWithinColumn,
  toPosixPath,
} from '@mos/core';
import type {
  AreaCollision,
  Card,
  Facet,
  FilterState,
  ParsedFile,
  ScopeDef,
  ScopeValue,
  VaultConfig,
  VaultModel,
} from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { CardComponent } from '../../components/card/card';
import { FilterBar } from '../../components/filter-bar/filter-bar';

/** Discriminated load state to drive the template honestly. */
type LoadState = 'loading' | 'loaded' | 'error';

/** One column on the board, with its name and sorted cards. */
export interface BoardColumn {
  name: string;
  cards: Card[];
}

/**
 * URL query keys this view owns (scope switcher + reader plumbing). A facet
 * whose field name collides with one of these is dropped, so an oddly-named
 * vault field can't hijack `?scope=`/`?q=`/etc. These are a web/URL concern, so
 * the guard lives here rather than in the (URL-agnostic) core `buildFacets`.
 */
const RESERVED_URL_KEYS = new Set(['scope', 'q', 'path', 'from']);

/**
 * Board view. Loads the vault config and all board-scope files, builds the
 * {@link VaultModel}, and renders one config-named **scope** at a time (its
 * cards in columns) with a **Backlog** sibling for unscheduled work, plus a
 * config-driven **filter bar** over both (F-023, ADR-020). A vault that
 * declares no scope renders an unscoped board with the same filter bar.
 *
 * Scope selection and filters live in the URL, so a board state is bookmarkable
 * and "back" from the reader restores it (ADR-004). The view is read-only — no
 * move handlers (ADR-002); columns, types, and scope all come from config
 * (ADR-003).
 */
@Component({
  selector: 'app-board-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, FilterBar],
  templateUrl: './board-view.html',
})
export class BoardView {
  private readonly source = inject(VAULT_SOURCE);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Wall-clock captured once; passed into the pure scope resolver (ADR-001). */
  private readonly now = Date.now();

  /** Discriminated load state: drives the template to show loading / error / content. */
  protected readonly loadState = signal<LoadState>('loading');

  /** Full vault config loaded from source. */
  protected readonly config = signal<VaultConfig | null>(null);

  /** The board-scope vault model; live updates patch it incrementally (F-005-S-01). */
  private readonly model = signal<VaultModel>(createEmptyVaultModel());

  /** Message describing why the board failed to load, shown in the error state. */
  protected readonly loadError = signal<string>('');

  /** URL query params; scope + filter state derive from here (single source). */
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Picker `<option>` value for the Backlog scope (can't collide with a name). */
  protected readonly BACKLOG_SENTINEL = '__backlog__';

  /**
   * The user's last explicit scope pick, remembered across sessions
   * (localStorage). Feeds the final tier of {@link resolveCurrentScope} when the
   * URL carries no scope and neither dates nor unfinished cards decide one.
   */
  private readonly lastSelection = signal<string | null>(null);

  /** Every card in the model. */
  private readonly allCards = computed(() => Object.values(this.model().cards));

  /**
   * Parallel-batch overlays (F-026, ADR-021), derived purely from the whole
   * model so they reflect global in-flight state regardless of the active scope
   * or filters. Empty for a vault with no `areas` — the board renders as before.
   */
  private readonly collisions = computed<Record<string, AreaCollision[]>>(() => {
    const config = this.config();
    return config === null ? {} : inFlightCollisions(this.model(), config);
  });

  /** Ids of ready cards safe to start: disjoint from every in-flight surface. */
  private readonly safeIds = computed<Set<string>>(() => {
    const config = this.config();
    return config === null ? new Set() : new Set(safeToStart(this.model(), config));
  });

  /** The vault's board scope, or `null` when it declares none (unscoped). */
  protected readonly scopeDef = computed<ScopeDef | null>(() => {
    const config = this.config();
    return config ? normalizeScope(config) : null;
  });

  /** True when the vault is scoped (shows scope UI + a Backlog). */
  protected readonly isScoped = computed(() => this.scopeDef() !== null);

  /** Raw `scope` param: `null` = default, `''` = Backlog, else a value name. */
  private readonly scopeRaw = computed(() => this.queryParams().get('scope'));

  /** True when the Backlog (empty-scope) view is selected. */
  protected readonly isBacklog = computed(() => this.isScoped() && this.scopeRaw() === '');

  /**
   * The scope value to show, resolving an absent param via dates then
   * fallbacks (ADR-020). `null` when unscoped or viewing the Backlog.
   */
  protected readonly currentScopeName = computed<string | null>(() => {
    const config = this.config();
    const scope = this.scopeDef();
    if (config === null || scope === null || this.isBacklog()) return null;
    const raw = this.scopeRaw();
    if (raw !== null && raw !== '' && scope.values.some((v) => v.name === raw)) return raw;
    return resolveCurrentScope(scope, this.allCards(), config, this.now, this.lastSelection() ?? undefined);
  });

  /** The current scope value object (for its dates), or `null`. */
  protected readonly currentScopeValue = computed<ScopeValue | null>(() => {
    const scope = this.scopeDef();
    const name = this.currentScopeName();
    if (scope === null || name === null) return null;
    return scope.values.find((v) => v.name === name) ?? null;
  });

  /** Whole days remaining in the current dated scope, or `null` when dateless. */
  protected readonly daysLeft = computed<number | null>(() => {
    const value = this.currentScopeValue();
    return value ? scopeDaysLeft(value, this.now) : null;
  });

  /** Countdown badge text: "n days left" / "last day" / "ended", or `null`. */
  protected readonly daysLeftLabel = computed<string | null>(() => {
    const days = this.daysLeft();
    if (days === null) return null;
    if (days > 0) return `${days} ${days === 1 ? 'day left' : 'days left'}`;
    return days === 0 ? 'last day' : 'ended';
  });

  /** The picker's bound value: the Backlog sentinel, or the current value name. */
  protected readonly pickerValue = computed(() =>
    this.isBacklog() ? this.BACKLOG_SENTINEL : (this.currentScopeName() ?? ''),
  );

  /** True when prev/next is at the start/end of the scope sequence. */
  protected readonly atFirst = computed(() => this.currentIndex() <= 0);
  protected readonly atLast = computed(() => this.currentIndex() >= this.scopeOrder().length - 1);

  /** Filter facets, built from config + cards (nothing hardcoded; ADR-003). */
  protected readonly facets = computed<Facet[]>(() => {
    const config = this.config();
    if (config === null) return [];
    return buildFacets(config, this.allCards()).filter(
      (facet) => !RESERVED_URL_KEYS.has(facet.field),
    );
  });

  /**
   * Current filter selection, read from the URL. Only known facet fields count,
   * so a stray param (a stale `?sprint=` bookmark, or the scope field itself —
   * which the switcher owns, not the filter bar) never silently filters cards.
   */
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

  /** Cards in the current scope (or all, if unscoped), narrowed by the filters. */
  private readonly visibleCards = computed<Card[]>(() => {
    const config = this.config();
    if (config === null) return [];
    let cards = this.allCards();
    const scope = this.scopeDef();
    if (scope !== null && !this.isBacklog()) {
      const name = this.currentScopeName();
      cards = cards.filter((card) => cardScopeValue(card, scope) === name);
    }
    return applyFilters(cards, this.filterState(), config);
  });

  /** Place visible cards into their config-driven columns (pure projection). */
  private readonly placement = computed(() => {
    const config = this.config();
    if (config === null) return { columns: [] as BoardColumn[], errors: [] as string[] };

    const columnMap = new Map<string, Card[]>(config.board.columns.map((col) => [col, []]));
    const errors: string[] = [];

    for (const card of this.visibleCards()) {
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

  /** Columns the template renders (board mode). */
  protected readonly columns = computed(() => this.placement().columns);

  /** Placement diagnostics for cards that couldn't be placed (unknown type/status). */
  protected readonly placementErrors = computed(() => this.placement().errors);

  /** The Backlog list: unscheduled, non-done cards narrowed by the filters. */
  protected readonly backlogResults = computed<Card[]>(() => {
    const config = this.config();
    const scope = this.scopeDef();
    if (config === null || scope === null) return [];
    return applyFilters(backlogCards(this.allCards(), config, scope), this.filterState(), config);
  });

  /** Total cards shown in the active view (board columns or the backlog). */
  protected readonly visibleCount = computed(() =>
    this.isBacklog()
      ? this.backlogResults().length
      : this.columns().reduce((sum, col) => sum + col.cards.length, 0),
  );

  constructor() {
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
      // Config changes redefine columns/types/scope — a full reload is safest.
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
      this.restoreLastSelection();

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

  /** In-flight area overlaps for a card (empty when none) — drives its badge. */
  protected collisionsFor(card: Card): AreaCollision[] {
    return this.collisions()[card.id] ?? [];
  }

  /** True when the card is ready and safe to start (disjoint from in-flight work). */
  protected isSafeToStart(card: Card): boolean {
    return this.safeIds().has(card.id);
  }

  // ── Scope switching ────────────────────────────────────────────────────────

  /** The scope sequence prev/next walks: every value, then the Backlog. */
  private scopeOrder(): string[] {
    const scope = this.scopeDef();
    return scope ? [...scope.values.map((v) => v.name), this.BACKLOG_SENTINEL] : [];
  }

  /** Index of the current selection within {@link scopeOrder}. */
  private currentIndex(): number {
    const scope = this.scopeDef();
    if (scope === null) return -1;
    if (this.isBacklog()) return scope.values.length;
    const i = scope.values.findIndex((v) => v.name === this.currentScopeName());
    return i < 0 ? 0 : i;
  }

  protected goPrev(): void {
    this.step(-1);
  }

  protected goNext(): void {
    this.step(1);
  }

  private step(delta: number): void {
    const order = this.scopeOrder();
    if (order.length === 0) return;
    const idx = Math.min(order.length - 1, Math.max(0, this.currentIndex() + delta));
    this.setScope(order[idx] === this.BACKLOG_SENTINEL ? '' : order[idx]);
  }

  protected onPickScope(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.setScope(value === this.BACKLOG_SENTINEL ? '' : value);
  }

  /** Write the scope into the URL (`''` = Backlog, `null` = default). */
  protected setScope(value: string | null): void {
    // Remember a concrete value pick (not Backlog/default) for next session.
    if (value !== null && value !== '') this.rememberSelection(value);
    this.mergeParams({ scope: value });
  }

  /** Per-vault, per-scope-field localStorage key, or `null` when unscoped/unnamed. */
  private scopeStorageKey(): string | null {
    const config = this.config();
    const scope = this.scopeDef();
    if (config === null || scope === null) return null;
    // localStorage is shared per origin and `vault.name` is the only client-side
    // discriminator. An empty name can't tell two vaults apart, so skip
    // persistence rather than have them clobber each other's remembered scope.
    if (config.vault.name === '') return null;
    return `mos:scope:${config.vault.name}:${scope.field}`;
  }

  /** Load the remembered scope pick into {@link lastSelection} (best-effort). */
  private restoreLastSelection(): void {
    const key = this.scopeStorageKey();
    if (key === null) return;
    try {
      this.lastSelection.set(localStorage.getItem(key));
    } catch {
      /* localStorage unavailable (private mode / non-browser) — skip */
    }
  }

  /** Persist the scope pick so a later visit re-opens on it (best-effort). */
  private rememberSelection(value: string): void {
    this.lastSelection.set(value);
    const key = this.scopeStorageKey();
    if (key === null) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      /* localStorage unavailable — keep the in-memory value only */
    }
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

  /** Open the card's file in the reader, carrying the board state for "back" (ADR-004). */
  protected onCardSelect(card: Card): void {
    const params: Record<string, string> = { path: card.path, from: 'board' };
    const current = this.queryParams();
    for (const key of current.keys) {
      const value = current.get(key);
      if (value !== null) params[key] = value;
    }
    void this.router.navigate(['/reader'], { queryParams: params });
  }
}
