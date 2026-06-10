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
  type ParsedFile,
  type VaultConfig,
  type VaultModel,
} from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { MarkdownReader } from '../../components/markdown-reader/markdown-reader';

/** Discriminated load state to drive the template honestly. */
type LoadState = 'loading' | 'loaded' | 'error';

/**
 * Reader view: the shared markdown reader as its own routable lens entry point
 * (F-004-S-04, ADR-004). Renders the file named by the `path` query parameter
 * with the same {@link MarkdownReader} the wiki uses, so internal links stay
 * live. The optional `from`/`sprint` query parameters drive the back control —
 * returning to the board restores its sprint filter.
 *
 * Read-only: the view shows the card; there is no edit affordance (ADR-002).
 */
@Component({
  selector: 'app-reader-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownReader, RouterLink],
  templateUrl: './reader-view.html',
})
export class ReaderView {
  private readonly source = inject(VAULT_SOURCE);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly loadError = signal<string>('');

  protected readonly config = signal<VaultConfig>(loadConfig('{}').config);
  protected readonly model = signal<VaultModel>(createEmptyVaultModel());

  /** Body of the currently displayed file ('' while loading or on read failure). */
  protected readonly body = signal<string>('');

  /** Set when the requested file can't be read, so the miss is visible (T-007). */
  protected readonly bodyError = signal<string>('');

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Vault-relative path of the file to display. */
  protected readonly path = computed(() => this.queryParams().get('path'));

  /** Which lens opened the reader; decides where "back" goes. */
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

  /** Round-trip the sprint filter so back lands on the same filtered board. */
  protected readonly backQueryParams = computed(() => {
    const sprint = this.queryParams().get('sprint');
    return this.from() === 'board' && sprint !== null ? { sprint } : {};
  });

  /** Body load is deferred until config + model are in place. */
  private modelReady = false;

  /** Monotonic token: a newer init() invalidates the writes of an older one. */
  private initSeq = 0;

  constructor() {
    void this.init();

    // React to path changes (internal link clicks stay on this route). The
    // initial load is handled by init() once config + model are in place.
    effect(() => {
      this.path(); // track
      if (this.modelReady) void this.loadBody();
    });

    // Live re-index: keep the model and the open file fresh (F-005-S-01).
    const unwatch = this.source.watch((path) => void this.onFileChange(path));
    inject(DestroyRef).onDestroy(unwatch);
  }

  /** Patch the model for one changed file; re-render it if it's the open one. */
  private async onFileChange(path: string): Promise<void> {
    if (!this.modelReady) return;
    const posix = toPosixPath(path);
    if (posix === '.mos/config.json') {
      void this.init();
      return;
    }

    let parsed: ParsedFile | null;
    try {
      parsed = parseFile(posix, await this.source.readFile(posix));
    } catch {
      parsed = null; // unreadable = treat as deleted
    }
    this.model.set(applyFileChange(this.model(), this.config(), posix, parsed).model);

    if (this.path() === posix) {
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

      // Parse the whole vault so internal links resolve to cards and docs alike.
      const parsedFiles = await Promise.all(
        allPaths.map(async (path) => {
          const posix = toPosixPath(path);
          try {
            const text = await this.source.readFile(posix);
            return parseFile(posix, text);
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
    const path = this.path();
    if (path === null || path === '') {
      this.body.set('');
      this.bodyError.set('No file selected.');
      return;
    }
    try {
      const text = await this.source.readFile(path);
      // A newer selection may have won the race while this read was in flight.
      if (this.path() !== path) return;
      this.body.set(parseFile(path, text).body);
      this.bodyError.set('');
    } catch (error: unknown) {
      if (this.path() !== path) return;
      this.body.set('');
      this.bodyError.set(
        `Couldn't read "${path}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Internal link click: stay in the reader, swap the file, keep from/sprint. */
  protected onNavigate(path: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { path },
      queryParamsHandling: 'merge',
    });
  }
}
