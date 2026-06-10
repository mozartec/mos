import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  applyFileChange,
  buildDependencyGraph,
  buildModel,
  createEmptyVaultModel,
  criticalPath,
  globToRegExp,
  loadConfig,
  parseFile,
  placeCard,
  readySet,
  toPosixPath,
  type ParsedFile,
  type VaultConfig,
  type VaultModel,
} from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';

/** Discriminated load state to drive the template honestly. */
type LoadState = 'loading' | 'loaded' | 'error';

/** Semantic node color, derived from the type's state→column mapping (ADR-003). */
export type NodeTone = 'todo' | 'active' | 'blocked' | 'done';

/** A core graph node with pixel geometry and paint info for the SVG template. */
export interface PositionedNode {
  id: string;
  title: string;
  status: string;
  tone: NodeTone;
  x: number;
  y: number;
  path: string;
  /** On the critical path (F-012-S-04): emphasised outline. */
  critical: boolean;
  /** In the ready set (F-012-S-04): badge — every dependency is done. */
  ready: boolean;
}

/** A core graph edge with endpoint coordinates for the SVG template. */
export interface PositionedEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  broken: boolean;
  /** Connects two consecutive critical-path nodes: emphasised stroke. */
  critical: boolean;
  key: string;
}

/** Node box and grid geometry (pixels). */
export const NODE_W = 200;
export const NODE_H = 52;
const CELL_W = 280;
const CELL_H = 76;
const PADDING = 20;

/**
 * Graph lens (F-012-S-03, ADR-011): renders the layered dependency graph the
 * pure core computed — nodes positioned by rank/order, directional edges
 * prerequisite → dependent, node color by status. The component only positions
 * and paints; it computes no ranks (ADR-001). Clicking a node opens the card
 * in the shared reader with a way back (ADR-004). Read-only (ADR-002).
 */
@Component({
  selector: 'app-graph-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './graph-view.html',
})
export class GraphView {
  private readonly source = inject(VAULT_SOURCE);
  private readonly router = inject(Router);

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly loadError = signal<string>('');
  protected readonly config = signal<VaultConfig | null>(null);
  private readonly model = signal<VaultModel>(createEmptyVaultModel());

  constructor() {
    void this.loadGraph();

    // Live re-index: the graph follows card changes like every other lens (F-005-S-01).
    const unwatch = this.source.watch((path) => void this.onFileChange(path));
    inject(DestroyRef).onDestroy(unwatch);
  }

  /** Re-parse just the changed file and patch the model; computeds react via signals. */
  private async onFileChange(path: string): Promise<void> {
    const config = this.config();
    if (config === null || this.loadState() !== 'loaded') return;

    const posix = toPosixPath(path);
    if (posix === '.mos/config.json') {
      // Config changes redefine columns/types — a full reload is the only safe move.
      void this.loadGraph();
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

  private async loadGraph(): Promise<void> {
    try {
      const [configText, allPaths] = await Promise.all([
        this.source.readFile('.mos/config.json').catch(() => '{}'),
        this.source.listFiles(),
      ]);

      const { config } = loadConfig(configText);
      this.config.set(config);

      // The graph is a board-scope lens: only card files feed it.
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

  /** The core-computed graph (geometry by rank/order; cycle-safe). */
  private readonly graph = computed(() => {
    const config = this.config();
    if (config === null) return { nodes: [], edges: [], errors: [] };
    return buildDependencyGraph(this.model(), config);
  });

  /** Diagnostics from edge resolution / cycle breaking, surfaced visibly (T-007). */
  protected readonly graphErrors = computed(() => this.graph().errors);

  /** Critical-path node ids, from core (F-012-S-04). */
  private readonly criticalIds = computed(() => new Set(criticalPath(this.graph())));

  /** Edge keys (`from->to`) joining consecutive critical-path nodes. */
  private readonly criticalEdgeKeys = computed(() => {
    const path = criticalPath(this.graph());
    const keys = new Set<string>();
    for (let i = 1; i < path.length; i++) {
      keys.add(`${path[i]}->${path[i - 1]}`); // path[i] depends on path[i-1]
    }
    return keys;
  });

  /** Ready-set ids, from core (F-012-S-04). */
  private readonly readyIds = computed(() => new Set(readySet(this.graph())));

  /**
   * Visible nodes with pixel positions. Hidden-state cards (state → null,
   * e.g. Deferred) stay off the lens, consistent with the board.
   */
  protected readonly nodes = computed<PositionedNode[]>(() => {
    const config = this.config();
    if (config === null) return [];
    const result: PositionedNode[] = [];
    for (const node of this.graph().nodes) {
      const card = this.model().cards[node.id];
      const placement = placeCard(card, config);
      if (placement.error !== undefined || placement.column === null) continue;
      result.push({
        id: node.id,
        title: node.title,
        status: node.status,
        tone: this.toneFor(placement, config),
        x: PADDING + node.rank * CELL_W,
        y: PADDING + node.order * CELL_H,
        path: card.path,
        critical: this.criticalIds().has(node.id),
        ready: this.readyIds().has(node.id),
      });
    }
    return result;
  });

  /** Edges between visible nodes, as line coordinates prerequisite → dependent. */
  protected readonly edges = computed<PositionedEdge[]>(() => {
    const byId = new Map(this.nodes().map((n) => [n.id, n]));
    const result: PositionedEdge[] = [];
    for (const edge of this.graph().edges) {
      const dependent = byId.get(edge.from);
      const prerequisite = byId.get(edge.to);
      if (dependent === undefined || prerequisite === undefined) continue;
      const key = `${edge.from}->${edge.to}`;
      result.push({
        x1: prerequisite.x + NODE_W,
        y1: prerequisite.y + NODE_H / 2,
        x2: dependent.x,
        y2: dependent.y + NODE_H / 2,
        broken: edge.broken === true,
        critical: this.criticalEdgeKeys().has(key),
        key,
      });
    }
    return result;
  });

  /** SVG canvas size from the node extents. */
  protected readonly canvas = computed(() => {
    let width = PADDING * 2 + NODE_W;
    let height = PADDING * 2 + NODE_H;
    for (const node of this.nodes()) {
      width = Math.max(width, node.x + NODE_W + PADDING);
      height = Math.max(height, node.y + NODE_H + PADDING);
    }
    return { width, height };
  });

  protected readonly NODE_W = NODE_W;
  protected readonly NODE_H = NODE_H;

  /**
   * Semantic tone from the card's already-computed placement — config-driven,
   * no hardcoded status names beyond the spec-defined `Blocked` badge rule.
   */
  private toneFor(placement: ReturnType<typeof placeCard>, config: VaultConfig): NodeTone {
    if (placement.blocked) return 'blocked';
    const columns = config.board.columns;
    if (placement.column === columns[columns.length - 1]) return 'done';
    if (placement.column === columns[0]) return 'todo';
    return 'active';
  }

  /** Open the node's card in the shared reader, with a way back here (ADR-004). */
  protected openNode(node: PositionedNode): void {
    void this.router.navigate(['/reader'], {
      queryParams: { path: node.path, from: 'graph' },
    });
  }

  protected nodeTrack(_index: number, node: PositionedNode): string {
    return node.id;
  }

  protected edgeTrack(_index: number, edge: PositionedEdge): string {
    return edge.key;
  }
}
