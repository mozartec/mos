import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { VaultSource } from '@mos/core';
import { BoardView, paramToSprintFilter, sprintFilterToParam } from './board-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { InMemoryVaultSource, settle } from '../../testing/test-helpers';

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
    sprint: { type: 'enum', source: 'sprints', label: 'Sprint' },
  },
  sprints: ['S1', 'S2'],
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
  sprint?: string,
): string {
  const lines = ['---', `id: ${id}`, `type: ${type}`, `status: ${status}`];
  if (priority) lines.push(`priority: ${priority}`);
  if (sprint) lines.push(`sprint: ${sprint}`);
  lines.push('---', '', `# ${id}`);
  return lines.join('\n');
}

describe('BoardView', () => {
  let lastSource: InMemoryVaultSource;

  async function createBoard(extraFiles: Record<string, string> = {}) {
    const source = new InMemoryVaultSource({
      '.mos/config.json': TEST_CONFIG,
      ...extraFiles,
    });
    lastSource = source;
    await TestBed.configureTestingModule({
      imports: [BoardView],
      providers: [provideRouter([]), { provide: VAULT_SOURCE, useValue: source }],
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
      providers: [provideRouter([]), { provide: VAULT_SOURCE, useValue: trackingSource }],
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

  // ── Acceptance F-004-S-03: sprint filter ──────────────────────────────────

  it('builds sprint options from config.sprints (All + sprints + Backlog)', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
    });
    const host = fixture.nativeElement as HTMLElement;
    const options = Array.from(host.querySelectorAll('select option')).map(
      (o) => o.textContent?.trim() ?? '',
    );
    expect(options).toEqual(['All', 'S1', 'S2', 'Backlog']);
  });

  it('selecting a sprint shows only its cards', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo', 'P0', 'S1'),
      'board/S-002.md': makeCard('S-002', 'story', 'Todo', 'P0', 'S2'),
      'board/S-003.md': makeCard('S-003', 'story', 'Todo', 'P0'),
    });
    const component = fixture.componentInstance;
    component['sprintFilter'].set('S1');
    fixture.detectChanges();
    const visible = component['columns']()
      .flatMap((c) => c.cards)
      .map((c) => c.id);
    expect(visible).toEqual(['S-001']);
  });

  it('"Backlog" shows only cards with no sprint', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo', 'P0', 'S1'),
      'board/S-003.md': makeCard('S-003', 'story', 'Todo', 'P0'),
    });
    const component = fixture.componentInstance;
    component['sprintFilter'].set('');
    fixture.detectChanges();
    const visible = component['columns']()
      .flatMap((c) => c.cards)
      .map((c) => c.id);
    expect(visible).toEqual(['S-003']);
  });

  it('URL-encodes the sprint filter without reserved words (empty = no sprint)', () => {
    // absent = All, `?sprint=` = no-sprint (Backlog), name = that sprint — so
    // even a sprint literally named "backlog" round-trips unambiguously.
    expect(sprintFilterToParam(null)).toBeUndefined();
    expect(sprintFilterToParam('')).toBe('');
    expect(sprintFilterToParam('backlog')).toBe('backlog');
    expect(paramToSprintFilter(null)).toBeNull();
    expect(paramToSprintFilter('')).toBe('');
    expect(paramToSprintFilter('backlog')).toBe('backlog');
  });

  it('"All" (default) shows every visible card', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo', 'P0', 'S1'),
      'board/S-003.md': makeCard('S-003', 'story', 'Todo', 'P0'),
    });
    const component = fixture.componentInstance;
    const visible = component['columns']()
      .flatMap((c) => c.cards)
      .map((c) => c.id);
    expect(visible).toEqual(['S-001', 'S-003']);
  });

  it('filtering via the select element updates the board', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo', 'P0', 'S1'),
      'board/S-002.md': makeCard('S-002', 'story', 'Todo', 'P0', 'S2'),
    });
    const host = fixture.nativeElement as HTMLElement;
    const select = host.querySelector('select') as HTMLSelectElement;
    select.value = 'S2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const visible = fixture.componentInstance['columns']()
      .flatMap((c) => c.cards)
      .map((c) => c.id);
    expect(visible).toEqual(['S-002']);
  });

  // ── Acceptance F-004-S-04: card click opens the reader ────────────────────

  it('navigates to the reader with the card path and sprint filter on select', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo', 'P0', 'S1'),
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance['sprintFilter'].set('S1');
    fixture.componentInstance['onCardSelect']({
      id: 'S-001',
      type: 'story',
      title: 'S-001',
      status: 'Todo',
      path: 'board/S-001.md',
      fields: {},
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/reader'], {
      queryParams: { path: 'board/S-001.md', from: 'board', sprint: 'S1' },
    });
  });

  // ── Acceptance F-005-S-01: live re-index ──────────────────────────────────

  it('moves a card on the board when its status changes on disk', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
    });
    lastSource.files['board/S-001.md'] = makeCard('S-001', 'story', 'Done');
    lastSource.emit('board/S-001.md');
    await settle(fixture);
    const columns = fixture.componentInstance['columns']();
    expect(columns.find((c) => c.name === 'Backlog')?.cards).toEqual([]);
    expect(columns.find((c) => c.name === 'Done')?.cards.map((c) => c.id)).toEqual(['S-001']);
  });

  it('re-parses only the changed file on a change event', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
      'board/S-002.md': makeCard('S-002', 'story', 'Todo'),
    });
    lastSource.readPaths.length = 0;
    lastSource.files['board/S-001.md'] = makeCard('S-001', 'story', 'Done');
    lastSource.emit('board/S-001.md');
    await settle(fixture);
    expect(lastSource.readPaths).toEqual(['board/S-001.md']);
  });

  it('removes a card from the board when its file is deleted', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
    });
    delete lastSource.files['board/S-001.md'];
    lastSource.emit('board/S-001.md');
    await settle(fixture);
    const allCards = fixture.componentInstance['columns']().flatMap((c) => c.cards);
    expect(allCards).toEqual([]);
  });

  it('adds a card to the board when a new file appears', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
    });
    lastSource.files['board/S-090.md'] = makeCard('S-090', 'story', 'In Progress');
    lastSource.emit('board/S-090.md');
    await settle(fixture);
    const inProgress = fixture.componentInstance['columns']().find((c) => c.name === 'In Progress');
    expect(inProgress?.cards.map((c) => c.id)).toEqual(['S-090']);
  });

  it('disposes the watch subscription on destroy (no leaks)', async () => {
    const fixture = await createBoard({
      'board/S-001.md': makeCard('S-001', 'story', 'Todo'),
    });
    expect(lastSource.unwatchedCount).toBe(0);
    fixture.destroy();
    expect(lastSource.unwatchedCount).toBe(1);
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
      providers: [provideRouter([]), { provide: VAULT_SOURCE, useValue: source }],
    }).compileComponents();
    const fixture = TestBed.createComponent(BoardView);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance['loadState']()).toBe('error');
  });
});
