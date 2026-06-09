import { TestBed } from '@angular/core/testing';
import type { VaultSource } from '@mos/core';
import { BoardView } from './board-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';

/** Minimal config with three columns and two card types. */
const TEST_CONFIG = JSON.stringify({
  specVersion: '0.2',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: {
    include: ['board/**/*.md'],
    columns: ['Backlog', 'In Progress', 'Done'],
    sortWithinColumn: ['priority', 'id'],
  },
  fields: {
    priority: { type: 'enum', values: ['P0', 'P1', 'P2', 'P3'], label: 'Priority' },
  },
  types: {
    story: {
      label: 'Story',
      states: {
        Todo: 'Backlog',
        'In Progress': 'In Progress',
        Blocked: 'In Progress',
        Done: 'Done',
      },
    },
    task: {
      label: 'Task',
      states: {
        Todo: 'Backlog',
        'In Progress': 'In Progress',
        Done: 'Done',
        Deferred: null,
      },
    },
  },
});

function makeCard(
  id: string,
  type: string,
  status: string,
  priority?: string,
): string {
  const lines = ['---', `id: ${id}`, `type: ${type}`, `status: ${status}`];
  if (priority) lines.push(`priority: ${priority}`);
  lines.push('---', '', `# ${id}`);
  return lines.join('\n');
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

describe('BoardView', () => {
  async function createBoard(extraFiles: Record<string, string> = {}) {
    const source = new TestVaultSource({
      '.mos/config.json': TEST_CONFIG,
      ...extraFiles,
    });
    await TestBed.configureTestingModule({
      imports: [BoardView],
      providers: [{ provide: VAULT_SOURCE, useValue: source }],
    }).compileComponents();
    const fixture = TestBed.createComponent(BoardView);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Acceptance 1: model built from source ─────────────────────────────────

  it('renders columns read from the vault config, not a hardcoded list', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
    });
    const host = fixture.nativeElement as HTMLElement;
    const headings = Array.from(host.querySelectorAll('h3')).map(
      (h) => h.textContent?.trim() ?? '',
    );
    // config has three columns; CSS uppercase is visual-only, textContent is original case
    expect(headings).toEqual(['Backlog', 'In Progress', 'Done']);
  });

  it('shows a card that is present in the source files', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('S-001');
  });

  it('does not read wiki/doc files — only board-scope paths', async () => {
    const readPaths: string[] = [];
    const trackingSource: VaultSource = {
      listFiles: () =>
        Promise.resolve([
          '.mos/config.json',
          'board/S-001.md',
          'docs/intro.md',
        ]),
      readFile: (path: string) => {
        readPaths.push(path);
        const files: Record<string, string> = {
          '.mos/config.json': TEST_CONFIG,
          'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
          'docs/intro.md': '# Intro',
        };
        const content = files[path];
        return content !== undefined
          ? Promise.resolve(content)
          : Promise.reject(new Error(`No such file: ${path}`));
      },
      watch: () => () => undefined,
    };
    await TestBed.configureTestingModule({
      imports: [BoardView],
      providers: [{ provide: VAULT_SOURCE, useValue: trackingSource }],
    }).compileComponents();
    const fixture = TestBed.createComponent(BoardView);
    await fixture.whenStable();
    fixture.detectChanges();
    // docs/intro.md must never be fetched when building the board
    expect(readPaths.some((p) => p.startsWith('docs/'))).toBe(false);
  });

  // ── Acceptance 2: columns in config order ────────────────────────────────

  it('renders columns in the config-defined order', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Done'),
      'board/S-002.md': makeCard('S-002', 'story', 'Todo'),
    });
    const host = fixture.nativeElement as HTMLElement;
    const headings = Array.from(host.querySelectorAll('h3')).map(
      (h) => h.textContent?.trim() ?? '',
    );
    // CSS uppercase is visual-only; compare with original config casing
    expect(headings.indexOf('Backlog')).toBeLessThan(headings.indexOf('In Progress'));
    expect(headings.indexOf('In Progress')).toBeLessThan(headings.indexOf('Done'));
  });

  it('places each card in its computed column', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
      'board/S-002.md': makeCard('S-002', 'story', 'In Progress'),
      'board/S-003.md': makeCard('S-003', 'story', 'Done'),
    });
    const component = fixture.componentInstance;
    const columns = component['columns']();
    expect(columns.find((c) => c.name === 'Backlog')?.cards.map((c) => c.id)).toEqual(['S-001']);
    expect(columns.find((c) => c.name === 'In Progress')?.cards.map((c) => c.id)).toEqual(['S-002']);
    expect(columns.find((c) => c.name === 'Done')?.cards.map((c) => c.id)).toEqual(['S-003']);
  });

  // ── Acceptance 3: cards sorted by priority then id ────────────────────────

  it('sorts cards within a column by priority then id', async () => {
    const fixture = await createBoard({
      'board/S-003.md': makeCard('S-003', 'story', 'Todo', 'P1'),
      'board/S-001.md': makeCard('S-001', 'story', 'Todo', 'P0'),
      'board/S-002.md': makeCard('S-002', 'story', 'Todo', 'P0'),
    });
    const component = fixture.componentInstance;
    const backlog = component['columns']().find((c) => c.name === 'Backlog');
    expect(backlog?.cards.map((c) => c.id)).toEqual(['S-001', 'S-002', 'S-003']);
  });

  // ── Acceptance 4: hidden-state cards absent ───────────────────────────────

  it('does not render cards in hidden states (Deferred)', async () => {
    const fixture = await createBoard({
      'board/T-001.md': makeCard('T-001', 'task', 'Deferred'),
      'board/T-002.md': makeCard('T-002', 'task', 'Todo'),
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('T-001');
    expect(text).toContain('T-002');
  });

  it("keeps Deferred cards out of every column's card list", async () => {
    const fixture = await createBoard({
      'board/T-001.md': makeCard('T-001', 'task', 'Deferred'),
    });
    const component = fixture.componentInstance;
    const allCards = component['columns']().flatMap((c) => c.cards);
    expect(allCards.map((c) => c.id)).not.toContain('T-001');
  });

  // ── Resilience: bad cards are skipped visibly, board does not crash ───────

  it('keeps a card with an unrecognized status off the columns without crashing', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
      'board/S-BAD.md': makeCard('S-BAD', 'story', 'UNKNOWN_STATUS'),
    });
    const component = fixture.componentInstance;
    const allCards = component['columns']().flatMap((c) => c.cards);
    expect(allCards.map((c) => c.id)).toContain('S-001');
    expect(allCards.map((c) => c.id)).not.toContain('S-BAD');
  });

  it('surfaces placement errors visibly instead of only logging (T-007)', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
      'board/S-BAD.md': makeCard('S-BAD', 'story', 'UNKNOWN_STATUS'),
    });
    const host = fixture.nativeElement as HTMLElement;
    const alert = host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain("1 card couldn't be placed");
    expect(alert?.textContent).toContain('S-BAD');
  });

  it('shows no placement alert when every card places cleanly', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  // ── LoadState transitions ─────────────────────────────────────────────────

  it('transitions loadState to "loaded" after a successful load', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
    });
    expect(fixture.componentInstance['loadState']()).toBe('loaded');
  });

  it('transitions loadState to "error" when the source rejects', async () => {
    const source: VaultSource = {
      listFiles: () => Promise.reject(new Error('network error')),
      readFile: () => Promise.reject(new Error('network error')),
      watch: () => () => undefined,
    };
    await TestBed.configureTestingModule({
      imports: [BoardView],
      providers: [{ provide: VAULT_SOURCE, useValue: source }],
    }).compileComponents();
    const fixture = TestBed.createComponent(BoardView);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance['loadState']()).toBe('error');
  });
});
