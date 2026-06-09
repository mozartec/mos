import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { VaultSource } from '@mos/core';
import { GraphView } from './graph-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';

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

function makeCard(id: string, status: string, dependsOn: string[] = []): string {
  return [
    '---',
    `id: ${id}`,
    'type: task',
    `title: Card ${id}`,
    `status: ${status}`,
    `dependsOn: [${dependsOn.join(', ')}]`,
    '---',
    '',
    `# ${id}`,
  ].join('\n');
}

class TestVaultSource implements VaultSource {
  constructor(private readonly files: Record<string, string>) {}
  listFiles(): Promise<string[]> {
    return Promise.resolve(Object.keys(this.files));
  }
  readFile(path: string): Promise<string> {
    const content = this.files[path];
    return content === undefined
      ? Promise.reject(new Error(`No such file: ${path}`))
      : Promise.resolve(content);
  }
  watch(): () => void {
    return () => undefined;
  }
}

describe('GraphView', () => {
  async function createGraph(extraFiles: Record<string, string> = {}) {
    const source = new TestVaultSource({
      '.mos/config.json': TEST_CONFIG,
      ...extraFiles,
    });
    await TestBed.configureTestingModule({
      imports: [GraphView],
      providers: [provideRouter([]), { provide: VAULT_SOURCE, useValue: source }],
    }).compileComponents();
    const fixture = TestBed.createComponent(GraphView);
    for (let i = 0; i < 5; i++) {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
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
});
