import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Card } from '@mos/core';
import { GraphView } from './graph-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { InMemoryVaultSource, settle } from '../../testing/test-helpers';

const TEST_CONFIG = JSON.stringify({
  specVersion: '0.3',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: {
    include: ['board/**/*.md'],
    columns: ['Backlog', 'In Progress', 'Done'],
    sortWithinColumn: ['priority', 'id'],
  },
  fields: {
    priority: { type: 'enum', values: ['P0', 'P1', 'P2', 'P3'] },
    dependsOn: { type: 'id', list: true },
  },
  types: {
    task: {
      label: 'Task',
      states: {
        Todo: 'Backlog',
        'In Progress': 'In Progress',
        Blocked: 'In Progress',
        Done: 'Done',
        Deferred: null,
      },
    },
  },
});

/** A copy of TEST_CONFIG that also declares `areas` + `touches` (turns on F-026). */
const AREAS_CONFIG = JSON.stringify({
  specVersion: '0.4',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: {
    include: ['board/**/*.md'],
    columns: ['Backlog', 'In Progress', 'Done'],
    sortWithinColumn: ['priority', 'id'],
  },
  fields: {
    priority: { type: 'enum', values: ['P0', 'P1', 'P2', 'P3'] },
    dependsOn: { type: 'id', list: true },
    touches: { type: 'enum', source: 'areas', list: true },
  },
  areas: { core: ['packages/core/**'], web: ['apps/web/**'] },
  types: {
    task: {
      label: 'Task',
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Blocked: 'In Progress', Done: 'Done', Deferred: null },
    },
  },
});

function makeCard(id: string, status: string, dependsOn: string[] = [], touches?: string[]): string {
  const lines = [
    '---',
    `id: ${id}`,
    'type: task',
    `title: Card ${id}`,
    `status: ${status}`,
    `dependsOn: [${dependsOn.join(', ')}]`,
  ];
  if (touches !== undefined) lines.push(`touches: [${touches.join(', ')}]`);
  lines.push('---', '', `# ${id}`);
  return lines.join('\n');
}

describe('GraphView', () => {
  async function createGraph(
    extraFiles: Record<string, string> = {},
    config: string = TEST_CONFIG,
  ) {
    const source = new InMemoryVaultSource({
      '.mos/config.json': config,
      ...extraFiles,
    });
    await TestBed.configureTestingModule({
      imports: [GraphView],
      providers: [provideRouter([]), { provide: VAULT_SOURCE, useValue: source }],
    }).compileComponents();
    const fixture = TestBed.createComponent(GraphView);
    await settle(fixture);
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders one SVG node per visible card, labelled with id and title', async () => {
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'Done'),
      'board/T-002.md': makeCard('T-002', 'Todo', ['T-001']),
    });
    const host = fixture.nativeElement as HTMLElement;
    const nodes = host.querySelectorAll('svg g[role="link"]');
    expect(nodes).toHaveLength(2);
    expect(host.textContent).toContain('T-001');
    expect(host.textContent).toContain('Card T-002');
  });

  it('positions a dependent at a higher rank (greater x) than its prerequisite', async () => {
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'Done'),
      'board/T-002.md': makeCard('T-002', 'Todo', ['T-001']),
    });
    const nodes = fixture.componentInstance['nodes']();
    const root = nodes.find((n) => n.id === 'T-001');
    const dependent = nodes.find((n) => n.id === 'T-002');
    expect(dependent!.x).toBeGreaterThan(root!.x);
  });

  it('draws a directional edge per dependency', async () => {
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'Done'),
      'board/T-002.md': makeCard('T-002', 'Todo', ['T-001']),
      'board/T-003.md': makeCard('T-003', 'Todo', ['T-001', 'T-002']),
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('svg line')).toHaveLength(3);
  });

  it('keeps hidden-state cards (Deferred) off the graph', async () => {
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'Todo'),
      'board/T-002.md': makeCard('T-002', 'Deferred'),
    });
    const nodes = fixture.componentInstance['nodes']();
    expect(nodes.map((n) => n.id)).toEqual(['T-001']);
  });

  it('marks cycle-broken edges and surfaces the cycle visibly', async () => {
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'Todo', ['T-002']),
      'board/T-002.md': makeCard('T-002', 'Todo', ['T-001']),
    });
    const host = fixture.nativeElement as HTMLElement;
    const dashed = host.querySelectorAll('svg line[stroke-dasharray]');
    expect(dashed).toHaveLength(1);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('dependency cycle');
  });

  it('derives node tone from the state→column mapping', async () => {
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'Done'),
      'board/T-002.md': makeCard('T-002', 'In Progress'),
      'board/T-003.md': makeCard('T-003', 'Blocked'),
      'board/T-004.md': makeCard('T-004', 'Todo'),
    });
    const tones = Object.fromEntries(
      fixture.componentInstance['nodes']().map((n) => [n.id, n.tone]),
    );
    expect(tones).toEqual({
      'T-001': 'done',
      'T-002': 'active',
      'T-003': 'blocked',
      'T-004': 'todo',
    });
  });

  // ── Acceptance F-012-S-04: critical path + ready set ──────────────────────

  it('emphasises the critical path nodes and edges', async () => {
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'Done'),
      'board/T-002.md': makeCard('T-002', 'Todo', ['T-001']),
      'board/T-003.md': makeCard('T-003', 'Todo', ['T-002']),
      'board/T-009.md': makeCard('T-009', 'Todo'), // off the path
    });
    const host = fixture.nativeElement as HTMLElement;
    const criticalRects = host.querySelectorAll('svg rect[data-critical]');
    expect(criticalRects).toHaveLength(3); // T-001 → T-002 → T-003
    const thickEdges = Array.from(host.querySelectorAll('svg line')).filter(
      (l) => l.getAttribute('stroke-width') === '3',
    );
    expect(thickEdges).toHaveLength(2);
  });

  it('badges exactly the ready-set nodes', async () => {
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'Done'),
      'board/T-002.md': makeCard('T-002', 'Todo', ['T-001']), // ready
      'board/T-003.md': makeCard('T-003', 'Todo', ['T-002']), // waiting
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('svg circle[data-ready]')).toHaveLength(1);
    const ready = fixture.componentInstance['nodes']().filter((n) => n.ready);
    expect(ready.map((n) => n.id)).toEqual(['T-002']);
  });

  it('shows a legend explaining tones, critical path, and ready badge', async () => {
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'Todo'),
    });
    const host = fixture.nativeElement as HTMLElement;
    const legend = host.querySelector('[aria-label="Graph legend"]');
    expect(legend).not.toBeNull();
    expect(legend?.textContent).toContain('Critical path');
    expect(legend?.textContent).toContain('Ready to start');
  });

  it('clicking a node opens the card in the shared reader with a way back', async () => {
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'Todo'),
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('svg g[role="link"]') as SVGGElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/reader'], {
      queryParams: { path: 'board/T-001.md', from: 'graph' },
    });
  });

  // ── F-026: collision markers + safe-to-start distinction ──────────────────

  it('marks in-flight nodes that share an area with a collision marker', async () => {
    const fixture = await createGraph(
      {
        'board/T-001.md': makeCard('T-001', 'In Progress', [], ['core']),
        'board/T-002.md': makeCard('T-002', 'In Progress', [], ['core']),
        'board/T-003.md': makeCard('T-003', 'In Progress', [], ['web']), // disjoint
      },
      AREAS_CONFIG,
    );
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('svg path[data-collision]')).toHaveLength(2);
    const collided = fixture.componentInstance['nodes']().filter((n) => n.collision);
    expect(collided.map((n) => n.id).sort()).toEqual(['T-001', 'T-002']);
    expect(collided[0].collisionLabel).toContain('core');
  });

  it('splits the ready set into safe (solid) and would-overlap (hollow) dots', async () => {
    const fixture = await createGraph(
      {
        'board/T-001.md': makeCard('T-001', 'In Progress', [], ['core']), // claims core
        'board/T-WEB.md': makeCard('T-WEB', 'Todo', [], ['web']), // ready, disjoint → safe
        'board/T-CORE.md': makeCard('T-CORE', 'Todo', [], ['core']), // ready, overlaps → unsafe
      },
      AREAS_CONFIG,
    );
    const host = fixture.nativeElement as HTMLElement;
    // All three are unblocked, so all carry a ready dot (an in-flight card is
    // "ready" in the dependency sense); only the disjoint Todo card is *safe*.
    expect(host.querySelectorAll('svg circle[data-ready]')).toHaveLength(3);
    expect(host.querySelectorAll('svg circle[data-safe]')).toHaveLength(1);
    const byId = Object.fromEntries(
      fixture.componentInstance['nodes']().map((n) => [n.id, n]),
    );
    expect(byId['T-WEB'].safe).toBe(true);
    expect(byId['T-CORE'].safe).toBe(false);
    expect(byId['T-CORE'].ready).toBe(true);
  });

  it('explains a hollow dot by reason: overlap vs undeclared surface', async () => {
    const fixture = await createGraph(
      {
        'board/T-001.md': makeCard('T-001', 'In Progress', [], ['core']), // claims core
        'board/T-CORE.md': makeCard('T-CORE', 'Todo', [], ['core']), // declared, overlaps
        'board/T-NONE.md': makeCard('T-NONE', 'Todo'), // ready, no touches → undeclared
      },
      AREAS_CONFIG,
    );
    const byId = Object.fromEntries(fixture.componentInstance['nodes']().map((n) => [n.id, n]));
    expect(byId['T-CORE'].readyTitle).toContain('overlaps');
    expect(byId['T-NONE'].readyTitle).toContain('undeclared');
  });

  it('does not assert an overlap that does not exist for a partially-malformed surface', async () => {
    // In-flight work claims only `web`; the ready card declares `core` (no overlap)
    // plus a malformed entry, so it is unsafe for the malformed reason — not a clash.
    const fixture = await createGraph(
      { 'board/T-001.md': makeCard('T-001', 'In Progress', [], ['web']) },
      AREAS_CONFIG,
    );
    const comp = fixture.componentInstance;
    const config = comp['config']()!;
    const card = {
      id: 'T-X',
      type: 'task',
      title: 'X',
      status: 'Todo',
      path: 'board/T-X.md',
      fields: { touches: ['core', ''] }, // 'core' valid, '' malformed
    } as unknown as Card;
    const title = comp['readyTitle'](card, config, true, true, false, new Set(['web']));
    expect(title).not.toContain('overlaps');
    expect(title).toContain('fully read');
  });

  it('does not claim in-flight overlap for an undeclared card when nothing is in flight', async () => {
    const fixture = await createGraph(
      { 'board/T-NONE.md': makeCard('T-NONE', 'Todo') }, // areas configured, nothing In Progress
      AREAS_CONFIG,
    );
    const node = fixture.componentInstance['nodes']().find((n) => n.id === 'T-NONE')!;
    expect(node.safe).toBe(false); // unknown surface can't be proven safe
    expect(node.dotFilled).toBe(false); // hollow
    expect(node.readyTitle).toContain('undeclared');
    expect(node.readyTitle).not.toContain('in-flight');
  });

  it('shows parallel legend entries when areas are configured', async () => {
    const fixture = await createGraph(
      { 'board/T-001.md': makeCard('T-001', 'Todo', [], ['core']) },
      AREAS_CONFIG,
    );
    const legend = (fixture.nativeElement as HTMLElement).querySelector('[aria-label="Graph legend"]');
    expect(legend?.textContent).toContain('Safe to start');
    expect(legend?.textContent).toContain('In-flight collision');
    expect(legend?.textContent).not.toContain('Ready to start'); // replaced by the parallel set
  });

  it('renders no parallel overlays for a vault without areas (zero-config silence)', async () => {
    // Same overlapping in-flight cards, but the default config declares no areas.
    const fixture = await createGraph({
      'board/T-001.md': makeCard('T-001', 'In Progress', [], ['core']),
      'board/T-002.md': makeCard('T-002', 'In Progress', [], ['core']),
      'board/T-003.md': makeCard('T-003', 'Todo'),
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('svg path[data-collision]')).toHaveLength(0);
    expect(host.querySelectorAll('svg circle[data-safe]')).toHaveLength(0);
    // The pre-F-026 ready dot and its legend label are unchanged (all 3 unblocked).
    expect(host.querySelectorAll('svg circle[data-ready]')).toHaveLength(3);
    expect(host.querySelector('[aria-label="Graph legend"]')?.textContent).toContain('Ready to start');
  });
});
