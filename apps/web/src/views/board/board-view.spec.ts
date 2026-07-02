import { Component } from '@angular/core';
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

/** Unscoped board that also declares `areas` + `touches` — turns on F-026 overlays. */
const WITH_AREAS = JSON.stringify({
  specVersion: '0.4',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: BOARD,
  fields: { ...FIELDS, touches: { type: 'enum', source: 'areas', list: true, label: 'Touches' } },
  areas: { core: ['packages/core/**'], web: ['apps/web/**'] },
  types: TYPES,
});

/** Groups the board into parent lanes (F-034). */
const BY_PARENT = JSON.stringify({
  specVersion: '0.4',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: { ...BOARD, laneField: 'parent' },
  fields: FIELDS,
  types: TYPES,
});

/** A vault with a dedicated container type (feature) over stories, for T-030. */
const WITH_FEATURE = JSON.stringify({
  specVersion: '0.4',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: BOARD,
  fields: FIELDS,
  types: {
    feature: {
      label: 'Feature',
      parent: null,
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
      card: { fields: ['priority'] },
    },
    story: {
      label: 'Story',
      parent: 'feature',
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
      card: { fields: ['priority'] },
    },
  },
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

/** A 0.3 vault: string `sprints`, no scopeField (the compat alias). Named, so
 * scope persistence (keyed by vault name) is exercisable. */
const ALIAS = JSON.stringify({
  specVersion: '0.3',
  vault: { name: 'demo' },
  wiki: { include: ['**/*.md'], exclude: [] },
  board: BOARD,
  fields: { ...FIELDS, sprint: { type: 'enum', source: 'sprints', label: 'Sprint' } },
  sprints: ['S1', 'S2'],
  types: TYPES,
});

/** Same alias vault but unnamed — persistence must be skipped (no name to key on). */
const ALIAS_UNNAMED = JSON.stringify({
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

/** Stand-in for the routes the peek's expand/doc controls navigate to. */
@Component({ selector: 'app-stub', template: 'stub' })
class StubView {}

/** Two board cards (with titles, so the peek's dialog has an accessible name). */
const PEEK_FILES: Record<string, string> = {
  'board/A.md': makeCard('A', 'story', 'Todo', { priority: 'P1', title: 'Card A' }),
  'board/B.md': makeCard('B', 'story', 'In Progress', { priority: 'P0', title: 'Card B' }),
};

/**
 * A board wired for the side peek: real `/board` for query-param round-trips,
 * stub `/card/:id` + `/reader` for expand/doc, and location mocks so a
 * simulated browser-back is observable.
 */
async function createPeekBoard(
  url = '/board',
  files: Record<string, string> = PEEK_FILES,
  config: string = UNSCOPED,
) {
  const source = new InMemoryVaultSource({ '.mos/config.json': config, ...files });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'board', component: BoardView },
        { path: 'card/:id', component: StubView },
        { path: 'reader', component: StubView },
      ]),
      { provide: VAULT_SOURCE, useValue: source },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  await settle(harness.fixture);
  return {
    harness,
    component: harness.routeDebugElement!.componentInstance as BoardView,
    host: harness.routeNativeElement as HTMLElement,
    source,
  };
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

  beforeEach(() => {
    // The node test env has no localStorage; provide a minimal in-memory stub
    // so the scope-persistence path (which the component guards in try/catch) is
    // exercisable.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it('does not offer the scope field as a filter facet, even via the 0.3 alias', async () => {
    const { component } = await createBoard({
      config: ALIAS,
      files: { 'board/A.md': makeCard('A', 'story', 'Todo', { sprint: 'S1' }) },
    });
    expect(component['isScoped']()).toBe(true);
    expect(component['facets']().map((f) => f.field)).not.toContain('sprint');
  });

  it('drops a facet whose field name collides with a reserved URL key', async () => {
    const reservedFieldConfig = JSON.stringify({
      specVersion: '0.4',
      wiki: { include: ['**/*.md'], exclude: [] },
      board: BOARD,
      fields: { ...FIELDS, q: { type: 'enum', values: ['a', 'b'], label: 'Q' } },
      types: {
        story: { label: 'Story', parent: null, states: { Todo: 'Backlog' }, card: { fields: ['priority', 'q'] } },
      },
    });
    const { component } = await createBoard({
      config: reservedFieldConfig,
      files: { 'board/A.md': makeCard('A', 'story', 'Todo', { q: 'a' }) },
    });
    expect(component['facets']().map((f) => f.field)).not.toContain('q');
  });

  it('labels an ended dated scope "ended" (not "last day")', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const { component } = await createBoard({ config: SCOPED_DATED, url: '/board?scope=S1' });
    expect(component['daysLeftLabel']()).toBe('ended'); // S1 ended 2026-06-07
  });

  // ── Acceptance 3 (cont.) / F-023: remembered scope selection ────────────────

  it('restores the last selected scope from localStorage when the URL carries none', async () => {
    localStorage.setItem('mos:scope:demo:sprint', 'S1');
    const { component } = await createBoard({ config: ALIAS }); // no dates, no cards
    expect(component['currentScopeName']()).toBe('S1'); // would default to S2 otherwise
  });

  it('persists an explicit scope selection to localStorage', async () => {
    const { harness, component } = await createBoard({ config: ALIAS });
    component['setScope']('S2');
    await settle(harness.fixture);
    expect(localStorage.getItem('mos:scope:demo:sprint')).toBe('S2');
  });

  it('skips scope persistence for an unnamed vault (no cross-vault collision)', async () => {
    const { harness, component } = await createBoard({ config: ALIAS_UNNAMED });
    component['setScope']('S2');
    await settle(harness.fixture);
    // Nothing written under the empty-name key — the feature is simply off here.
    expect(localStorage.getItem('mos:scope::sprint')).toBeNull();
  });

  // ── Side peek (F-021-S-03) ───────────────────────────────────────────────────

  const CLICKED_A = {
    id: 'A',
    type: 'story',
    title: 'Card A',
    status: 'Todo',
    path: 'board/A.md',
    fields: {},
  };

  describe('side peek', () => {
    it('opens the peek for a clicked card, pushing ?peek= and keeping the board state', async () => {
      const { component, host, harness } = await createPeekBoard('/board?priority=P1');
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      component['onCardSelect'](CLICKED_A);
      await settle(harness.fixture);

      // Pushed (not replaced) and merged onto the existing filter, so the
      // board's own state survives and browser-back can return to the board.
      expect(navigateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { peek: 'A' },
          queryParamsHandling: 'merge',
          replaceUrl: false,
        }),
      );
      expect(router.url).toContain('peek=A');
      expect(router.url).toContain('priority=P1');

      // A proper dialog rendered over the still-present board.
      const dialog = host.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
      expect(dialog?.getAttribute('aria-label')).toBe('Card A');
      expect(dialog?.textContent).toContain('Card A');
      expect(host.querySelector('[aria-label="Board columns"]')).not.toBeNull();
    });

    it('renders the peek on load from a ?peek= deep link (shareable)', async () => {
      const { host } = await createPeekBoard('/board?peek=B');
      const dialog = host.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute('aria-label')).toBe('Card B');
      expect(dialog?.textContent).toContain('Card B');
    });

    it('Esc closes the peek', async () => {
      const { host, harness } = await createPeekBoard('/board?peek=A');
      const panel = host.querySelector('.peek-panel') as HTMLElement;
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle(harness.fixture);

      expect(host.querySelector('[role="dialog"]')).toBeNull();
      expect(TestBed.inject(Router).url).not.toContain('peek');
    });

    it('the backdrop closes the peek; a click inside the panel does not', async () => {
      const { host, harness } = await createPeekBoard('/board?peek=A');
      const panel = host.querySelector('.peek-panel') as HTMLElement;
      // The scrim backdrop is the wrapper's own button (the toolbar buttons sit
      // deeper, inside the panel).
      const backdrop = host.querySelector('.fixed > button[aria-label="Close peek"]') as HTMLButtonElement;

      panel.click(); // inside the panel — no close affordance there, stays open
      await settle(harness.fixture);
      expect(host.querySelector('[role="dialog"]')).not.toBeNull();

      backdrop.click(); // the scrim backdrop — closes
      await settle(harness.fixture);
      expect(host.querySelector('[role="dialog"]')).toBeNull();
    });

    it('opening pushes a history entry, so browser back (URL without ?peek=) closes it', async () => {
      const { component, host, harness } = await createPeekBoard('/board?priority=P1');
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');
      component['onCardSelect'](CLICKED_A);
      await settle(harness.fixture);
      // Pushed (not replaced) — the back button has a prior entry to return to.
      expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({ replaceUrl: false }));
      expect(host.querySelector('[role="dialog"]')).not.toBeNull();

      // Back restores that prior URL (no ?peek=); the peek is a pure function of
      // the param, so it closes. (RouterTestingHarness doesn't wire history.back,
      // so we drive the same URL transition the back button produces.)
      await TestBed.inject(Router).navigateByUrl('/board?priority=P1');
      await settle(harness.fixture);
      expect(host.querySelector('[role="dialog"]')).toBeNull();
    });

    it('the expand control navigates to the full card page, carrying board state', async () => {
      const { host, harness } = await createPeekBoard('/board?priority=P1&peek=A');
      const expandBtn = Array.from(host.querySelectorAll('.peek-panel button')).find((b) =>
        (b.textContent ?? '').includes('Expand'),
      ) as HTMLButtonElement;

      expandBtn.click();
      await settle(harness.fixture);

      const url = TestBed.inject(Router).url;
      expect(url).toContain('/card/A');
      expect(url).toContain('from=board');
      expect(url).toContain('priority=P1');
      expect(url).not.toContain('peek');
    });

    it('a relation click swaps the peeked card in place (replaces, no new history)', async () => {
      const { component, host, harness } = await createPeekBoard('/board?peek=A');
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');
      // Drive the detail's relation output the way the template wires it.
      component['swapPeek']('B');
      await settle(harness.fixture);
      // Replaced (not pushed): the peek keeps its single history entry, so back
      // returns to the bare board instead of re-opening A.
      expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({ replaceUrl: true }));
      expect(TestBed.inject(Router).url).toContain('peek=B');
      expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Card B');
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

  // ── F-026: parallel-batch overlays (collision badge + safe-to-start) ─────────

  it('badges in-flight cards that declare a shared area', async () => {
    const { host } = await createBoard({
      config: WITH_AREAS,
      files: {
        'board/T-001.md': makeCard('T-001', 'task', 'In Progress', { touches: '[core]' }),
        'board/T-002.md': makeCard('T-002', 'task', 'In Progress', { touches: '[core]' }),
        'board/T-003.md': makeCard('T-003', 'task', 'In Progress', { touches: '[web]' }), // disjoint
      },
    });
    const collisionBadges = host.querySelectorAll('.badge-warning');
    expect(collisionBadges).toHaveLength(2); // T-001 and T-002, not T-003
    for (const badge of collisionBadges) expect(badge.textContent).toContain('core');
  });

  it('highlights a ready card clear of in-flight work, not one that would collide', async () => {
    const { host } = await createBoard({
      config: WITH_AREAS,
      files: {
        'board/T-001.md': makeCard('T-001', 'task', 'In Progress', { touches: '[core]' }), // claims core
        'board/T-WEB.md': makeCard('T-WEB', 'task', 'Todo', { touches: '[web]' }), // ready, disjoint → safe
        'board/T-CORE.md': makeCard('T-CORE', 'task', 'Todo', { touches: '[core]' }), // ready, overlaps → unsafe
      },
    });
    // Exactly one safe-to-start badge, and one card carries the accent ring.
    expect([...host.querySelectorAll('.badge-accent')].map((b) => b.textContent?.trim())).toEqual([
      'Safe to start',
    ]);
    const ringed = [...host.querySelectorAll('app-card')].filter((el) =>
      el.className.includes('ring-accent'),
    );
    expect(ringed).toHaveLength(1);
    expect(host.querySelectorAll('.badge-warning')).toHaveLength(0); // only one in-flight card
  });

  it('renders no overlays for a vault without areas (zero-config silence)', async () => {
    const { host } = await createBoard({
      config: UNSCOPED,
      files: {
        'board/T-001.md': makeCard('T-001', 'task', 'In Progress', { touches: '[core]' }),
        'board/T-002.md': makeCard('T-002', 'task', 'In Progress', { touches: '[core]' }),
        'board/T-003.md': makeCard('T-003', 'task', 'Todo', { touches: '[web]' }),
      },
    });
    expect(host.querySelectorAll('.badge-warning')).toHaveLength(0);
    expect(host.textContent).not.toContain('Safe to start');
    expect(
      [...host.querySelectorAll('app-card')].filter((el) => el.className.includes('ring-accent')),
    ).toHaveLength(0);
  });

  // ── F-022: subcards — leaves in columns, containers as progress (ADR-019) ────

  describe('subcards', () => {
    /** A feature with two stories: F-1 is a container, S-1/S-2 are leaves. */
    const HIERARCHY_FILES = {
      'board/F-1.md': makeCard('F-1', 'story', 'In Progress', { title: 'The feature' }),
      'board/S-1.md': makeCard('S-1', 'story', 'Done', { parent: 'F-1' }),
      'board/S-2.md': makeCard('S-2', 'story', 'Todo', { parent: 'F-1' }),
    };

    it('keeps containers out of columns; column counts mean leaves', async () => {
      const { component, host } = await createBoard({
        config: UNSCOPED,
        files: HIERARCHY_FILES,
      });
      const columns = component['columns']();
      expect(columns.flatMap((c) => c.cards.map((card) => card.id))).toEqual(['S-2', 'S-1']);
      // 'In Progress' holds nothing: its only candidate (F-1) is a container.
      expect(columns.find((c) => c.name === 'In Progress')?.cards).toEqual([]);
      // The visible count and the per-column count badges agree: 2 leaves.
      expect(component['visibleCount']()).toBe(2);
      expect(host.textContent).toContain('2 cards');
    });

    it('still surfaces a placement error for a container with an unknown status', async () => {
      const { host } = await createBoard({
        config: UNSCOPED,
        files: {
          'board/F-1.md': makeCard('F-1', 'story', 'UNKNOWN'),
          'board/S-1.md': makeCard('S-1', 'story', 'Todo', { parent: 'F-1' }),
        },
      });
      // Skipped from columns as a container, but its bad status is not swallowed.
      const alert = host.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('F-1');
    });

    it('shows a child card with a parent breadcrumb chip that opens the container peek', async () => {
      const { host, harness } = await createPeekBoard('/board', {
        'board/F-1.md': makeCard('F-1', 'story', 'In Progress', { title: 'The feature' }),
        'board/S-1.md': makeCard('S-1', 'story', 'Todo', { parent: 'F-1', title: 'A story' }),
      });
      const crumb = host.querySelector('app-card button[title^="Open F-1"]') as HTMLButtonElement;
      expect(crumb).not.toBeNull();
      expect(crumb.textContent).toContain('The feature');

      crumb.click();
      await settle(harness.fixture);

      // The container's peek, not the child's.
      expect(TestBed.inject(Router).url).toContain('peek=F-1');
      expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('The feature');
    });

    it('lists a container in the Backlog with its n/m-done progress chip', async () => {
      const scopedFiles = {
        // Unscoped (no sprint) + non-done, so all three land in the Backlog view.
        'board/F-1.md': makeCard('F-1', 'story', 'Todo', { title: 'The feature' }),
        'board/S-1.md': makeCard('S-1', 'story', 'Done', { parent: 'F-1' }),
        'board/S-2.md': makeCard('S-2', 'story', 'Todo', { parent: 'F-1' }),
      };
      const { host } = await createBoard({
        config: SCOPED_DATED,
        files: scopedFiles,
        url: '/board?scope=',
      });
      const rows = [...host.querySelectorAll('app-card')];
      const containerRow = rows.find((el) => el.textContent?.includes('F-1'));
      expect(containerRow?.textContent).toContain('1/2 done');
      // Leaves carry no progress chip.
      const leafRow = rows.find((el) => el.textContent?.includes('S-2'));
      expect(leafRow?.textContent).not.toContain('done');
    });

    it('renders a flat vault (no parent fields) exactly as before', async () => {
      const { component, host } = await createBoard({
        config: UNSCOPED,
        files: {
          'board/R-1.md': makeCard('R-1', 'story', 'Todo'),
          'board/R-2.md': makeCard('R-2', 'story', 'In Progress'),
        },
      });
      const columns = component['columns']();
      expect(columns.find((c) => c.name === 'Backlog')?.cards.map((c) => c.id)).toEqual(['R-1']);
      expect(columns.find((c) => c.name === 'In Progress')?.cards.map((c) => c.id)).toEqual(['R-2']);
      // No breadcrumb or progress chrome appears anywhere.
      expect(host.textContent).not.toContain('done');
      expect([...host.querySelectorAll('[title^="Open "]')]).toHaveLength(0);
    });

    it('does not crash on a stray parent pointing at a missing id; the card renders chipless', async () => {
      const { component, host } = await createBoard({
        config: UNSCOPED,
        files: { 'board/S-1.md': makeCard('S-1', 'story', 'Todo', { parent: 'GHOST' }) },
      });
      // The card still places normally (GHOST isn't a card, so S-1 is a leaf)...
      expect(component['columns']().find((c) => c.name === 'Backlog')?.cards.map((c) => c.id)).toEqual(['S-1']);
      // ...and no breadcrumb chip renders for the unresolvable parent.
      expect([...host.querySelectorAll('[title^="Open "]')]).toHaveLength(0);
    });
  });

  // ── F-034: swimlanes (group-by-parent lanes) ────────────────────────────────

  describe('swimlanes', () => {
    const LANE_FILES = {
      'board/F-1.md': makeCard('F-1', 'story', 'In Progress', { title: 'The feature' }),
      'board/S-1.md': makeCard('S-1', 'story', 'Done', { parent: 'F-1' }),
      'board/S-2.md': makeCard('S-2', 'story', 'Todo', { parent: 'F-1' }),
    };

    it('groups the board into parent lanes with a progress header, collapsed by default', async () => {
      const { component, host } = await createBoard({ config: BY_PARENT, files: LANE_FILES });
      expect(component['laneMode']()).toBe(true);
      const lanes = component['lanes']();
      expect(lanes.map((l) => l.key)).toEqual(['F-1']);
      expect(lanes[0].progress).toEqual({ done: 1, total: 2 });
      // Collapsed by default: the container header shows, but no leaf card does.
      expect(host.textContent).toContain('The feature');
      expect(host.querySelectorAll('app-card')).toHaveLength(0);
      const toggle = host.querySelector('button[aria-label^="Expand lane F-1"]');
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    });

    it('expands a lane via ?expand=, revealing its leaves in the columns', async () => {
      const { component, host, harness } = await createBoard({
        config: BY_PARENT,
        files: LANE_FILES,
      });
      component['toggleLane']('F-1');
      await settle(harness.fixture);
      expect(TestBed.inject(Router).url).toContain('expand=F-1');
      // Both leaves render; the container (F-1) is a header, never a card.
      const texts = [...host.querySelectorAll('app-card')].map((el) => el.textContent);
      expect(texts).toHaveLength(2);
      expect(texts.some((t) => t?.includes('S-1'))).toBe(true);
      expect(texts.every((t) => !t?.includes('The feature'))).toBe(true);
    });

    it('opens the container peek when the lane header is clicked', async () => {
      const { host, harness } = await createPeekBoard(
        '/board',
        {
          'board/F-1.md': makeCard('F-1', 'story', 'In Progress', { title: 'The feature' }),
          'board/S-1.md': makeCard('S-1', 'story', 'Todo', { parent: 'F-1', title: 'Story one' }),
        },
        BY_PARENT,
      );
      const header = host.querySelector('button[title^="Open F-1"]') as HTMLButtonElement;
      expect(header).not.toBeNull();
      header.click();
      await settle(harness.fixture);
      expect(TestBed.inject(Router).url).toContain('peek=F-1');
      expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('The feature');
    });

    it('renders a flat board (no laneField) with no lane chrome', async () => {
      const { component, host } = await createBoard({
        config: UNSCOPED,
        files: { 'board/S-1.md': makeCard('S-1', 'story', 'Todo') },
      });
      expect(component['laneMode']()).toBe(false);
      expect(host.querySelectorAll('button[aria-label^="Expand lane"]')).toHaveLength(0);
    });
  });

  // ── T-030: board Type facet drops container-only types ──────────────────────

  it('drops a container-only type from the board Type facet, keeping leaf types', async () => {
    const { component } = await createBoard({
      config: WITH_FEATURE,
      files: {
        'board/F-1.md': makeCard('F-1', 'feature', 'In Progress'), // container
        'board/S-1.md': makeCard('S-1', 'story', 'Todo', { parent: 'F-1' }), // leaf
      },
    });
    const typeFacet = component['facets']().find((f) => f.field === 'type');
    // 'feature' (all its cards are containers) is gone; 'story' (has a leaf) stays.
    expect(typeFacet?.options.map((o) => o.value)).toEqual(['story']);
  });
});
