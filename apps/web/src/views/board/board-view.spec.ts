import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BoardView } from './board-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { InMemoryVaultSource, settle } from '../../testing/test-helpers';

/** Fixed clock within the S2 window of the dated config below. */
const NOW = Date.parse('2026-06-13T12:00:00Z');

const TYPES = {
  story: {
    label: 'Story',
    parent: null,
    states: {
      Todo: 'Backlog',
      'In Progress': 'In Progress',
      Blocked: 'In Progress',
      Done: 'Done',
      Deferred: null,
    },
    card: { fields: ['priority', 'owner'] },
  },
  task: {
    label: 'Task',
    parent: null,
    states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done', Deferred: null },
    card: { fields: ['priority', 'owner'] },
  },
};

const BOARD = {
  include: ['board/**/*.md'],
  columns: ['Backlog', 'In Progress', 'Done'],
  sortWithinColumn: ['priority', 'id'],
};

const FIELDS = {
  priority: { type: 'enum', values: ['P0', 'P1', 'P2', 'P3'], label: 'Priority' },
  owner: { type: 'string', label: 'Owner' },
};

/** No scopeField and no sprints — an unscoped board (like this repo's vault). */
const UNSCOPED = JSON.stringify({
  specVersion: '0.4',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: BOARD,
  fields: FIELDS,
  types: TYPES,
});

/** A scopeField with dated inline values. */
const SCOPED_DATED = JSON.stringify({
  specVersion: '0.4',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: { ...BOARD, scopeField: 'sprint' },
  fields: {
    ...FIELDS,
    sprint: {
      type: 'enum',
      label: 'Sprint',
      values: [
        { name: 'S1', starts: '2026-06-01', ends: '2026-06-07' },
        { name: 'S2', starts: '2026-06-08', ends: '2026-06-21' },
        { name: 'S3', starts: '2026-06-22', ends: '2026-07-05' },
      ],
    },
  },
  types: TYPES,
});

/** A 0.3 vault: string `sprints`, no scopeField (the compat alias). */
const ALIAS = JSON.stringify({
  specVersion: '0.3',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: BOARD,
  fields: { ...FIELDS, sprint: { type: 'enum', source: 'sprints', label: 'Sprint' } },
  sprints: ['S1', 'S2'],
  types: TYPES,
});

function makeCard(id: string, type: string, status: string, fields: Record<string, string> = {}): string {
  const lines = ['---', `id: ${id}`, `type: ${type}`, `status: ${status}`];
  for (const [key, value] of Object.entries(fields)) lines.push(`${key}: ${value}`);
  lines.push('---', '', `# ${id}`);
  return lines.join('\n');
}

describe('BoardView', () => {
  let lastSource: InMemoryVaultSource;

  async function createBoard(opts: {
    config: string;
    files?: Record<string, string>;
    url?: string;
  }) {
    const source = new InMemoryVaultSource({ '.mos/config.json': opts.config, ...(opts.files ?? {}) });
    lastSource = source;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'board', component: BoardView }]),
        { provide: VAULT_SOURCE, useValue: source },
      ],
    });
    const harness = await RouterTestingHarness.create(opts.url ?? '/board');
    await settle(harness.fixture);
    const component = harness.routeDebugElement!.componentInstance as BoardView;
    return { harness, component, host: harness.routeNativeElement as HTMLElement };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  // ── Retained board behavior ────────────────────────────────────────────────

  it('renders columns read from the vault config, not a hardcoded list', async () => {
    const { host } = await createBoard({
      config: UNSCOPED,
      files: { 'board/S-001.md': makeCard('S-001', 'story', 'Todo') },
    });
    const headings = Array.from(host.querySelectorAll('h3')).map((h) => h.textContent?.trim() ?? '');
    expect(headings).toEqual(['Backlog', 'In Progress', 'Done']);
  });

  it('places each card in its computed column, sorted by priority then id', async () => {
    const { component } = await createBoard({
      config: UNSCOPED,
      files: {
        'board/S-003.md': makeCard('S-003', 'story', 'Todo', { priority: 'P1' }),
        'board/S-001.md': makeCard('S-001', 'story', 'Todo', { priority: 'P0' }),
        'board/S-002.md': makeCard('S-002', 'story', 'In Progress', { priority: 'P0' }),
      },
    });
    const columns = component['columns']();
    expect(columns.find((c) => c.name === 'Backlog')?.cards.map((c) => c.id)).toEqual(['S-001', 'S-003']);
    expect(columns.find((c) => c.name === 'In Progress')?.cards.map((c) => c.id)).toEqual(['S-002']);
  });

  it('keeps hidden-state (Deferred) cards off every column', async () => {
    const { component } = await createBoard({
      config: UNSCOPED,
      files: { 'board/T-001.md': makeCard('T-001', 'task', 'Deferred') },
    });
    expect(component['columns']().flatMap((c) => c.cards)).toEqual([]);
  });

  it('surfaces placement errors for unplaceable cards', async () => {
    const { host } = await createBoard({
      config: UNSCOPED,
      files: { 'board/S-BAD.md': makeCard('S-BAD', 'story', 'UNKNOWN') },
    });
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("1 card couldn't be placed");
    expect(alert?.textContent).toContain('S-BAD');
  });

  it('live re-indexes a card when its status changes on disk', async () => {
    const { harness, component } = await createBoard({
      config: UNSCOPED,
      files: { 'board/S-001.md': makeCard('S-001', 'story', 'Todo') },
    });
    lastSource.files['board/S-001.md'] = makeCard('S-001', 'story', 'Done');
    lastSource.emit('board/S-001.md');
    await settle(harness.fixture);
    const columns = component['columns']();
    expect(columns.find((c) => c.name === 'Backlog')?.cards).toEqual([]);
    expect(columns.find((c) => c.name === 'Done')?.cards.map((c) => c.id)).toEqual(['S-001']);
  });

  // ── Acceptance 2: unscoped board, no scope UI, no legacy sprint select ──────

  it('renders an unscoped board with the filter bar and no scope UI', async () => {
    const { host, component } = await createBoard({
      config: UNSCOPED,
      files: { 'board/S-001.md': makeCard('S-001', 'story', 'Todo') },
    });
    expect(component['isScoped']()).toBe(false);
    expect(host.querySelector('[aria-label="Select scope"]')).toBeNull();
    expect(host.querySelector('app-filter-bar')).not.toBeNull();
    // The legacy sprint <select> is gone: no select named "Sprint".
    const selectLabels = Array.from(host.querySelectorAll('select')).map((s) =>
      s.getAttribute('aria-label'),
    );
    expect(selectLabels).not.toContain('Sprint');
  });

  // ── Acceptance 1: dated scope opens current, shows days left, round-trips ───

  it('opens the dated board on the date-current scope and shows days remaining', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const { host, component } = await createBoard({
      config: SCOPED_DATED,
      files: { 'board/S-001.md': makeCard('S-001', 'story', 'Todo', { sprint: 'S2' }) },
    });
    expect(component['currentScopeName']()).toBe('S2');
    expect(component['daysLeft']()).toBe(8);
    expect(host.textContent).toContain('days left');
  });

  it('the picker and prev/next switch scope and write it to the URL', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const { harness, component } = await createBoard({ config: SCOPED_DATED });
    component['goPrev'](); // from S2 → S1
    await settle(harness.fixture);
    expect(TestBed.inject(Router).url).toContain('scope=S1');
    component['onPickScope']({ target: { value: 'S3' } } as unknown as Event);
    await settle(harness.fixture);
    expect(TestBed.inject(Router).url).toContain('scope=S3');
  });

  it('round-trips an explicit scope from the URL', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const { component } = await createBoard({ config: SCOPED_DATED, url: '/board?scope=S1' });
    expect(component['currentScopeName']()).toBe('S1');
    expect(component['pickerValue']()).toBe('S1');
  });

  it('narrows the board to the cards in the current scope', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const { component } = await createBoard({
      config: SCOPED_DATED,
      files: {
        'board/A.md': makeCard('A', 'story', 'Todo', { sprint: 'S2' }),
        'board/B.md': makeCard('B', 'story', 'Todo', { sprint: 'S1' }),
      },
    });
    expect(component['columns']().flatMap((c) => c.cards).map((c) => c.id)).toEqual(['A']);
  });

  // ── Acceptance 3: 0.3 alias renders as sprint-scoped, fallback, no countdown ─

  it('reads a 0.3 string `sprints` vault as sprint-scoped, falling back to the last value with unfinished cards', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const { component } = await createBoard({
      config: ALIAS,
      files: {
        'board/A.md': makeCard('A', 'story', 'Done', { sprint: 'S2' }),
        'board/B.md': makeCard('B', 'story', 'Todo', { sprint: 'S1' }),
      },
    });
    expect(component['isScoped']()).toBe(true);
    // S2's only card is Done; S1 has an unfinished card → fall back to S1.
    expect(component['currentScopeName']()).toBe('S1');
    expect(component['daysLeft']()).toBeNull(); // no dates → no countdown
  });

  // ── Acceptance 4: backlog ──────────────────────────────────────────────────

  it('lists exactly the non-done, non-hidden, empty-scope cards ranked by priority then id', async () => {
    const { component } = await createBoard({
      config: SCOPED_DATED,
      url: '/board?scope=',
      files: {
        'board/A.md': makeCard('A', 'story', 'Todo', { priority: 'P1' }), // backlog
        'board/E.md': makeCard('E', 'story', 'In Progress', { priority: 'P0' }), // backlog, other column
        'board/B.md': makeCard('B', 'story', 'Done', { priority: 'P0' }), // done
        'board/C.md': makeCard('C', 'story', 'Deferred', { priority: 'P0' }), // hidden
        'board/D.md': makeCard('D', 'story', 'Todo', { sprint: 'S1', priority: 'P0' }), // scoped
      },
    });
    expect(component['isBacklog']()).toBe(true);
    expect(component['backlogResults']().map((c) => c.id)).toEqual(['E', 'A']);
  });

  it('has no backlog for a scope-less vault', async () => {
    const { component } = await createBoard({ config: UNSCOPED, url: '/board?scope=' });
    expect(component['isScoped']()).toBe(false);
    expect(component['isBacklog']()).toBe(false);
    expect(component['backlogResults']()).toEqual([]);
  });

  // ── Acceptance 5: filters compose, persist, options from config ─────────────

  it('builds filter facets from config (type + priority) and data (owner), excluding the scope field', async () => {
    const { component } = await createBoard({
      config: SCOPED_DATED,
      files: {
        'board/A.md': makeCard('A', 'story', 'Todo', { owner: 'alice', sprint: 'S2' }),
        'board/B.md': makeCard('B', 'task', 'Todo', { owner: 'bob', sprint: 'S2' }),
      },
    });
    const facets = component['facets']();
    expect(facets.find((f) => f.field === 'type')?.options.map((o) => o.value)).toEqual(['story', 'task']);
    expect(facets.find((f) => f.field === 'priority')?.options.map((o) => o.value)).toEqual(['P0', 'P1', 'P2', 'P3']);
    expect(facets.find((f) => f.field === 'owner')?.options.map((o) => o.value)).toEqual(['alice', 'bob']);
    expect(facets.map((f) => f.field)).not.toContain('sprint'); // scope field excluded
  });

  it('applies and composes filters from the URL on the board', async () => {
    const { component } = await createBoard({
      config: UNSCOPED,
      url: '/board?type=story&priority=P0',
      files: {
        'board/A.md': makeCard('A', 'story', 'Todo', { priority: 'P0' }),
        'board/B.md': makeCard('B', 'story', 'Todo', { priority: 'P1' }),
        'board/C.md': makeCard('C', 'task', 'Todo', { priority: 'P0' }),
      },
    });
    expect(component['columns']().flatMap((c) => c.cards).map((c) => c.id)).toEqual(['A']);
  });

  it('persists a filter change to the URL', async () => {
    const { harness, component } = await createBoard({ config: UNSCOPED });
    component['onFilterChange']({ q: '', values: { priority: 'P0' } });
    await settle(harness.fixture);
    expect(TestBed.inject(Router).url).toContain('priority=P0');
  });

  it('applies filters to the backlog too', async () => {
    const { component } = await createBoard({
      config: SCOPED_DATED,
      url: '/board?scope=&owner=alice',
      files: {
        'board/A.md': makeCard('A', 'story', 'Todo', { owner: 'alice' }),
        'board/B.md': makeCard('B', 'story', 'Todo', { owner: 'bob' }),
      },
    });
    expect(component['backlogResults']().map((c) => c.id)).toEqual(['A']);
  });

  it('free-text filter matches id, title, and string fields like owner', async () => {
    const { component } = await createBoard({
      config: UNSCOPED,
      url: '/board?q=alice',
      files: {
        'board/A.md': makeCard('A', 'story', 'Todo', { owner: 'alice' }),
        'board/B.md': makeCard('B', 'story', 'Todo', { owner: 'bob' }),
      },
    });
    expect(component['columns']().flatMap((c) => c.cards).map((c) => c.id)).toEqual(['A']);
  });

  // ── Reader round-trip ───────────────────────────────────────────────────────

  it('opens the reader carrying the board state for "back"', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const { component } = await createBoard({ config: SCOPED_DATED, url: '/board?scope=S1&priority=P0' });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component['onCardSelect']({
      id: 'A',
      type: 'story',
      title: 'A',
      status: 'Todo',
      path: 'board/A.md',
      fields: {},
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/reader'], {
      queryParams: { path: 'board/A.md', from: 'board', scope: 'S1', priority: 'P0' },
    });
  });

  // ── LoadState ───────────────────────────────────────────────────────────────

  it('transitions loadState to "error" when the source rejects', async () => {
    const source = {
      listFiles: () => Promise.reject(new Error('network error')),
      readFile: () => Promise.reject(new Error('network error')),
      watch: () => () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'board', component: BoardView }]),
        { provide: VAULT_SOURCE, useValue: source },
      ],
    });
    const harness = await RouterTestingHarness.create('/board');
    await settle(harness.fixture);
    const component = harness.routeDebugElement!.componentInstance as BoardView;
    expect(component['loadState']()).toBe('error');
  });
});
