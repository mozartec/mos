import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  applyFileChange,
  buildModel,
  createEmptyVaultModel,
  loadConfig,
  parseFile,
  toPosixPath,
  type Card,
  type ParsedFile,
  type VaultConfig,
  type VaultModel,
} from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { CardDetail } from '../../components/card-detail/card-detail';

/** Discriminated load state to drive the template honestly. */
type LoadState = 'loading' | 'loaded' | 'error';

/**
 * Card page (F-021-S-02): the id-addressed lens for one card (`/card/:id`),
 * lazy-loaded and bookmarkable like the other lenses (ADR-004). It parses the
 * whole vault so relations and in-body links resolve, hands the resolved card to
 * the shared {@link CardDetail}, and wires navigation — relation clicks and
 * in-body card links walk the route (keeping a back-trail), in-body doc links
 * fall through to the reader. A `from` query param drives "back", carrying the
 * originating board's scope + filters so it restores exactly (F-023), like the
 * reader. Read-only (ADR-002).
 */
@Component({
  selector: 'app-card-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardDetail, RouterLink],
  templateUrl: './card-view.html',
})
export class CardView {
  private readonly source = inject(VAULT_SOURCE);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly loadError = signal<string>('');

  protected readonly config = signal<VaultConfig>(loadConfig('{}').config);
  protected readonly model = signal<VaultModel>(createEmptyVaultModel());

  /** Body of the open card ('' while loading or on read failure). */
  protected readonly body = signal<string>('');

  /** Set when the card's file can't be read, so the miss is visible (T-007). */
  protected readonly bodyError = signal<string>('');

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** The `:id` route segment naming the card to show. */
  protected readonly cardId = computed(() => this.params().get('id'));

  /** The resolved card, or null when no card in the vault carries this id. */
  protected readonly card = computed<Card | null>(() => {
    const id = this.cardId();
    if (id === null) return null;
    return this.model().cards[id] ?? null;
  });

  /** Which lens opened the page; decides where "back" goes (F-023). */
  private readonly from = computed(() => this.queryParams().get('from'));

  protected readonly backLink = computed(() => {
    const from = this.from();
    if (from === 'board') return '/board';
    if (from === 'graph') return '/graph';
    return '/wiki';
  });
  protected readonly backLabel = computed(() => {
    const from = this.from();
    if (from === 'board') return 'Board';
    if (from === 'graph') return 'Graph';
    return 'Wiki';
  });

  /**
   * Round-trip the board's state (scope + filters) so "back" lands on the same
   * view it was opened from — the same contract the reader honors. Everything
   * but the page's own `from` rides along.
   */
  protected readonly backQueryParams = computed(() => {
    if (this.from() !== 'board') return {};
    const params = this.queryParams();
    const restored: Record<string, string> = {};
    for (const key of params.keys) {
      if (key === 'from') continue;
      const value = params.get(key);
      if (value !== null) restored[key] = value;
    }
    return restored;
  });

  /** Body load is deferred until config + model are in place. */
  private modelReady = false;

  /** Monotonic token: a newer init() invalidates the writes of an older one. */
  private initSeq = 0;

  constructor() {
    void this.init();

    // React to id changes (relation/body clicks navigate this same route). The
    // initial load is handled by init() once config + model are in place.
    effect(() => {
      this.cardId(); // track
      if (this.modelReady) void this.loadBody();
    });

    // Live re-index: keep the model and the open card fresh (F-005-S-01).
    const unwatch = this.source.watch((path) => void this.onFileChange(path));
    inject(DestroyRef).onDestroy(unwatch);
  }

  /** Patch the model for one changed file; re-render the open card if it changed. */
  private async onFileChange(path: string): Promise<void> {
    if (!this.modelReady) return;
    const posix = toPosixPath(path);
    if (posix === '.mos/config.json') {
      void this.init();
      return;
    }

    const openPath = this.card()?.path;

    let parsed: ParsedFile | null;
    try {
      parsed = parseFile(posix, await this.source.readFile(posix));
    } catch {
      parsed = null; // unreadable = treat as deleted
    }
    this.model.set(applyFileChange(this.model(), this.config(), posix, parsed).model);

    if (openPath === posix) {
      if (parsed === null) {
        this.body.set('');
        this.bodyError.set(`Couldn't read "${posix}": the file is gone.`);
      } else {
        this.body.set(parsed.body);
        this.bodyError.set('');
      }
    }
  }

  private async init(): Promise<void> {
    const seq = ++this.initSeq;
    try {
      const [configText, allPaths] = await Promise.all([
        this.source.readFile('.mos/config.json').catch(() => '{}'),
        this.source.listFiles(),
      ]);
      if (seq !== this.initSeq) return; // superseded by a newer init

      const { config } = loadConfig(configText);
      this.config.set(config);

      // Parse the whole vault so relations and internal links resolve.
      const parsedFiles = await Promise.all(
        allPaths.map(async (path) => {
          const posix = toPosixPath(path);
          try {
            return parseFile(posix, await this.source.readFile(posix));
          } catch {
            return null;
          }
        }),
      );
      if (seq !== this.initSeq) return; // superseded by a newer init
      const { model } = buildModel(
        parsedFiles.filter((f) => f !== null),
        config,
      );
      this.model.set(model);
      this.modelReady = true;

      await this.loadBody();
      this.loadState.set('loaded');
    } catch (error: unknown) {
      this.loadError.set(error instanceof Error ? error.message : String(error));
      this.loadState.set('error');
    }
  }

  private async loadBody(): Promise<void> {
    const card = this.card();
    if (card === null) {
      this.body.set('');
      this.bodyError.set('');
      return;
    }
    const path = card.path;
    try {
      const text = await this.source.readFile(path);
      // A newer card selection may have won the race while this read was in flight.
      if (this.card()?.path !== path) return;
      this.body.set(parseFile(path, text).body);
      this.bodyError.set('');
    } catch (error: unknown) {
      if (this.card()?.path !== path) return;
      this.body.set('');
      this.bodyError.set(
        `Couldn't read "${path}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Open a related card by id, keeping the back-trail params (F-023). */
  protected goToCard(id: string): void {
    void this.router.navigate(['/card', id], { queryParams: this.currentQueryParams() });
  }

  /**
   * An in-body link resolved to a vault path (F-017): a board card opens on its
   * own page; any other file (a wiki doc) falls through to the reader, so docs
   * still open in the reader exactly as before.
   */
  protected onBodyNavigate(path: string): void {
    const posix = toPosixPath(path);
    const card = Object.values(this.model().cards).find((c) => toPosixPath(c.path) === posix);
    if (card) {
      this.goToCard(card.id);
      return;
    }
    void this.router.navigate(['/reader'], { queryParams: { path: posix } });
  }

  /** The current query params as a plain object, to carry across navigations. */
  private currentQueryParams(): Record<string, string> {
    const params = this.queryParams();
    const out: Record<string, string> = {};
    for (const key of params.keys) {
      const value = params.get(key);
      if (value !== null) out[key] = value;
    }
    return out;
  }
}
