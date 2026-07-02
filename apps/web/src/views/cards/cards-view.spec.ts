import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CardsView } from './cards-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { InMemoryVaultSource, settle } from '../../testing/test-helpers';

/** Stand-in for the routes the peek's expand/doc controls navigate to. */
@Component({ selector: 'app-stub', template: 'stub' })
class StubView {}

/**
 * This vault's own vocabulary: two types with different card faces, so the
 * table's column union and blank cells are both exercised.
 */
const CONFIG = JSON.stringify({
  specVersion: '0.4',
  vault: { name: 'cards-test' },
  wiki: { include: ['**/*.md'], exclude: [] },
  board: {
    include: ['board/**/*.md'],
    columns: ['Backlog', 'In Progress', 'Done'],
    sortWithinColumn: ['priority', 'id'],
  },
  fields: {
    id: { type: 'id', label: 'ID' },
    title: { type: 'string', label: 'Title' },
    status: { type: 'string', label: 'Status' },
    priority: { type: 'enum', values: ['P0', 'P1', 'P2'], label: 'Priority' },
    owner: { type: 'string', label: 'Owner' },
    updated: { type: 'datetime', label: 'Updated' },
  },
  types: {
    story: {
      label: 'Story',
      parent: null,
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
      card: { fields: ['priority', 'owner', 'updated'] },
    },
    task: {
      label: 'Task',
      parent: null,
      states: { Todo: 'Backlog', Done: 'Done' },
      card: { fields: ['priority'] },
    },
  },
});

/** A scoped variant: the scope field must arrive as a plain facet here. */
const SCOPED = JSON.stringify({
  ...JSON.parse(CONFIG),
  board: { ...JSON.parse(CONFIG).board, scopeField: 'sprint' },
  fields: {
    ...JSON.parse(CONFIG).fields,
    sprint: { type: 'enum', values: ['S1', 'S2'], label: 'Sprint' },
  },
});

/**
 * A foreign-vocabulary vault (recipe-box-shaped): custom types, states, and a
 * field this repo's code never names. The table must derive everything.
 */
const RECIPE = JSON.stringify({
  specVersion: '0.4',
  vault: { name: 'recipe-box' },
  wiki: { include: ['**/*.md'], exclude: [] },
  board: {
    include: ['board/**/*.md'],
    columns: ['Idea', 'Testing', 'Served'],
    sortWithinColumn: [],
  },
  fields: {
    id: { type: 'id', label: 'ID' },
    title: { type: 'string', label: 'Title' },
    status: { type: 'string', label: 'Status' },
    serves: { type: 'string', label: 'Serves' },
    difficulty: { type: 'enum', values: ['easy', 'tricky', 'heroic'], label: 'Difficulty' },
  },
  types: {
    recipe: {
      label: 'Recipe',
      parent: null,
      states: { Idea: 'Idea', Testing: 'Testing', Served: 'Served' },
      card: { fields: ['serves', 'difficulty'] },
    },
  },
});

function makeCard(
  id: string,
  type: string,
  status: string,
  fields: Record<string, string> = {},
): string {
  const lines = ['---', `id: ${id}`, `type: ${type}`, `status: ${status}`];
  for (const [key, value] of Object.entries(fields)) lines.push(`${key}: ${value}`);
  lines.push('---', '', `# ${id}`);
  return lines.join('\n');
}

const FILES: Record<string, string> = {
  'board/S-1.md': makeCard('S-1', 'story', 'Todo', {
    title: 'First story',
    priority: 'P1',
    owner: 'alice',
  }),
  'board/S-2.md': makeCard('S-2', 'story', 'Done', { title: 'Second story', priority: 'P0' }),
  'board/T-1.md': makeCard('T-1', 'task', 'Todo', { title: 'A task', priority: 'P2' }),
};

describe('CardsView', () => {
  let lastSource: InMemoryVaultSource;

  async function createCards(opts: {
    config?: string;
    files?: Record<string, string>;
    url?: string;
  }) {
    const source = new InMemoryVaultSource({
      '.mos/config.json': opts.config ?? CONFIG,
      ...(opts.files ?? FILES),
    });
    lastSource = source;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'cards', component: CardsView },
          { path: 'card/:id', component: StubView },
          { path: 'reader', component: StubView },
        ]),
        { provide: VAULT_SOURCE, useValue: source },
      ],
    });
    const harness = await RouterTestingHarness.create(opts.url ?? '/cards');
    await settle(harness.fixture);
    const component = harness.routeDebugElement!.componentInstance as CardsView;
    return { harness, component, host: harness.routeNativeElement as HTMLElement };
  }

  afterEach(() => TestBed.resetTestingModule());

  /** Header labels without the active-sort arrow (the default sort marks ID). */
  const headerLabels = (host: HTMLElement) =>
    [...host.querySelectorAll('th')].map((th) =>
      (th.textContent ?? '').replace(/[▲▼]/g, '').trim(),
    );

  // ── Acceptance 1: every card, config-derived columns ────────────────────────

  it('lists every card in the vault with a result count', async () => {
    const { host } = await createCards({});
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(host.textContent).toContain('3 cards');
    for (const id of ['S-1', 'S-2', 'T-1']) expect(host.textContent).toContain(id);
  });

  it('derives columns from config: intrinsics, then the union of card faces in registry order', async () => {
    const { host } = await createCards({});
    // owner/updated come from the story face only; task rows render them blank.
    expect(headerLabels(host)).toEqual([
      'ID',
      'Type',
      'Title',
      'Status',
      'Priority',
      'Owner',
      'Updated',
    ]);
  });

  it('renders a foreign-vocabulary vault correctly with zero code changes', async () => {
    const { host } = await createCards({
      config: RECIPE,
      files: {
        'board/R-1.md': makeCard('R-1', 'recipe', 'Testing', {
          title: 'Shakshuka',
          serves: '4',
          difficulty: 'easy',
        }),
      },
    });
    expect(headerLabels(host)).toEqual(['ID', 'Type', 'Title', 'Status', 'Serves', 'Difficulty']);
    const row = host.querySelector('tbody tr');
    expect(row?.textContent).toContain('Shakshuka');
    expect(row?.textContent).toContain('Recipe'); // configured type label
    expect(row?.textContent).toContain('Testing'); // its own state vocabulary
    expect(row?.textContent).toContain('4');
  });

  it('shows the empty state when nothing matches', async () => {
    const { host } = await createCards({ url: '/cards?q=nomatch' });
    expect(host.textContent).toContain('0 cards');
    expect(host.textContent).toContain('No cards match.');
    expect(host.querySelector('table')).toBeNull();
  });

  // ── Acceptance 2: filters + sort compose, persist in the URL ────────────────

  it('offers status and scope facets on top of the board set', async () => {
    const { component } = await createCards({ config: SCOPED });
    const fields = component['facets']().map((f) => f.field);
    expect(fields).toContain('status');
    expect(fields).toContain('sprint'); // the scope field, a plain facet here
    expect(fields).toContain('type');
    expect(fields).toContain('priority');
  });

  it('applies and composes filters from the URL', async () => {
    const { host } = await createCards({ url: '/cards?type=story&status=Todo' });
    const rows = [...host.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('S-1');
  });

  it('persists a filter change to the URL', async () => {
    const { component, harness } = await createCards({});
    component['onFilterChange']({ q: 'story', values: { status: 'Done' } });
    await settle(harness.fixture);
    const url = TestBed.inject(Router).url;
    expect(url).toContain('q=story');
    expect(url).toContain('status=Done');
  });

  it('sorts by id ascending by default, and by a clicked header via ?sort=', async () => {
    const { host, harness } = await createCards({});
    const ids = () =>
      [...host.querySelectorAll('tbody tr button')].map((b) => b.textContent?.trim());
    expect(ids()).toEqual(['S-1', 'S-2', 'T-1']);

    const priorityHeader = [...host.querySelectorAll('th button')].find((b) =>
      b.textContent?.includes('Priority'),
    ) as HTMLButtonElement;
    priorityHeader.click();
    await settle(harness.fixture);

    // Enum order comes from config (P0 < P1 < P2), and the URL carries the sort.
    expect(TestBed.inject(Router).url).toContain('sort=priority');
    expect(ids()).toEqual(['S-2', 'S-1', 'T-1']);

    priorityHeader.click(); // second click flips the direction
    await settle(harness.fixture);
    expect(TestBed.inject(Router).url).toContain('sort=-priority');
    expect(ids()).toEqual(['T-1', 'S-1', 'S-2']);
  });

  it('renders a ?sort= deep link sorted on load, with aria-sort on the header', async () => {
    const { host } = await createCards({ url: '/cards?sort=-priority' });
    const ids = [...host.querySelectorAll('tbody tr button')].map((b) => b.textContent?.trim());
    expect(ids).toEqual(['T-1', 'S-1', 'S-2']);
    const th = [...host.querySelectorAll('th')].find((h) => h.textContent?.includes('Priority'));
    expect(th?.getAttribute('aria-sort')).toBe('descending');
  });

  it('sorts cards missing the field to the bottom in either direction', async () => {
    const files = {
      ...FILES,
      'board/S-3.md': makeCard('S-3', 'story', 'Todo', { title: 'No owner' }),
    };
    const { host } = await createCards({ files, url: '/cards?sort=owner' });
    const ids = [...host.querySelectorAll('tbody tr button')].map((b) => b.textContent?.trim());
    // alice first; the three ownerless cards follow in id order.
    expect(ids).toEqual(['S-1', 'S-2', 'S-3', 'T-1']);
  });

  // ── Acceptance 3: rows open like board cards; keyboard operable ────────────

  it('opens the side peek when a row is clicked, pushing ?peek=', async () => {
    const { host, harness } = await createCards({});
    (host.querySelector('tbody tr') as HTMLElement).click();
    await settle(harness.fixture);

    expect(TestBed.inject(Router).url).toContain('peek=S-1');
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-label')).toBe('First story');
  });

  it('gives every row a real button (keyboard path) whose Enter opens the same peek', async () => {
    const { host, harness } = await createCards({});
    const idButton = host.querySelector('tbody tr button') as HTMLButtonElement;
    expect(idButton.textContent?.trim()).toBe('S-1');
    idButton.click(); // what Enter dispatches on a focused button
    await settle(harness.fixture);
    expect(TestBed.inject(Router).url).toContain('peek=S-1');
  });

  it('renders the peek on load from a ?peek= deep link (shareable)', async () => {
    const { host } = await createCards({ url: '/cards?peek=S-2' });
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Second story');
  });

  it('expanding the peek lands on the card page carrying table state as from=cards, minus peek', async () => {
    const { component, harness } = await createCards({
      url: '/cards?type=story&sort=-priority&peek=S-1',
    });
    component['expandPeek']('S-1');
    await settle(harness.fixture);

    const url = TestBed.inject(Router).url;
    expect(url).toContain('/card/S-1');
    expect(url).toContain('from=cards');
    expect(url).toContain('type=story');
    expect(url).toContain('sort=-priority');
    expect(url).not.toContain('peek');
  });

  it('closing the peek drops ?peek= by replacing the URL (no extra history entry)', async () => {
    const { component, harness, host } = await createCards({ url: '/cards?peek=S-1' });
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');

    component['closePeek']();
    await settle(harness.fixture);

    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { peek: null }, replaceUrl: true }),
    );
    expect(TestBed.inject(Router).url).not.toContain('peek');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('reloads columns and facets when the config changes on disk', async () => {
    const { host, harness } = await createCards({});
    const next = JSON.parse(CONFIG);
    next.fields.estimate = { type: 'enum', values: ['S', 'M', 'L'], label: 'Estimate' };
    next.types.story.card.fields.push('estimate');
    lastSource.files['.mos/config.json'] = JSON.stringify(next);
    lastSource.emit('.mos/config.json');
    await settle(harness.fixture);

    expect(headerLabels(host)).toContain('Estimate');
  });

  // ── F-022: container rows carry the children-progress chip ─────────────────

  it('shows the n/m-done progress chip on container rows only', async () => {
    const files = {
      'board/F-1.md': makeCard('F-1', 'story', 'In Progress', { title: 'The feature' }),
      'board/S-1.md': makeCard('S-1', 'story', 'Done', { parent: 'F-1' }),
      'board/S-2.md': makeCard('S-2', 'story', 'Todo', { parent: 'F-1' }),
    };
    const { host } = await createCards({ files });
    const rows = [...host.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(3); // containers are rows here, not hidden
    const containerRow = rows.find((r) => r.querySelector('button')?.textContent?.trim() === 'F-1');
    expect(containerRow?.textContent).toContain('1/2 done');
    const leafRow = rows.find((r) => r.querySelector('button')?.textContent?.trim() === 'S-2');
    expect(leafRow?.textContent).not.toContain('done');
  });

  // ── Live reload (F-005-S-01) ────────────────────────────────────────────────

  it('live re-indexes a card when its file changes on disk', async () => {
    const { host, harness } = await createCards({});
    lastSource.files['board/S-1.md'] = makeCard('S-1', 'story', 'Done', {
      title: 'First story, renamed',
    });
    lastSource.emit('board/S-1.md');
    await settle(harness.fixture);
    expect(host.textContent).toContain('First story, renamed');
  });
});
