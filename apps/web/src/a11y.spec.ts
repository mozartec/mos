import { TestBed } from '@angular/core/testing';
import type { Type } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import axe from 'axe-core';
import { App } from './app/app';
import { BoardView } from './views/board/board-view';
import { CardView } from './views/card/card-view';
import { CardsView } from './views/cards/cards-view';
import { GraphView } from './views/graph/graph-view';
import { ReaderView } from './views/reader/reader-view';
import { WikiView } from './views/wiki/wiki-view';
import { VAULT_SOURCE } from './sources/vault-source.token';
import { InMemoryVaultSource, settle } from './testing/test-helpers';

/**
 * AXE checks for every lens, with the document carrying each registered theme
 * (apps/web AGENTS.md: views MUST pass AXE; design system §Accessibility).
 *
 * jsdom does no layout, so axe's color-contrast rule cannot run here — it is
 * disabled below. Color contrast is enforced instead by the token-pair math in
 * `design-system.spec.ts`, which covers both themes.
 */

const TEST_CONFIG = JSON.stringify({
  specVersion: '0.3',
  vault: { name: 'A11y Test Vault' },
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
    priority: { type: 'enum', values: ['P0', 'P1'], label: 'Priority' },
    dependsOn: { type: 'id', list: true, label: 'Depends on' },
  },
  types: {
    task: {
      label: 'Task',
      color: 'blue',
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
      card: { fields: ['id', 'priority', 'dependsOn'] },
    },
  },
});

const TEST_FILES: Record<string, string> = {
  '.mos/config.json': TEST_CONFIG,
  'docs/welcome.md': '# Welcome\n\nSome *prose* with a [link](docs/other.md).\n',
  'docs/other.md': '# Other\n',
  'board/T-001.md':
    '---\nid: T-001\ntype: task\ntitle: First task\nstatus: Done\npriority: P0\n---\n\n# T-001\n',
  // `parent: T-001` makes T-001 a container and gives T-002 a breadcrumb chip,
  // so the audits cover the F-022 chrome (chip button, progress chip) too.
  'board/T-002.md':
    '---\nid: T-002\ntype: task\ntitle: Second task\nstatus: In Progress\npriority: P1\nparent: T-001\ndependsOn: [T-001]\n---\n\n# T-002\n',
};

async function renderAndAudit(
  component: Type<unknown>,
  theme: string,
  loadedMarker: string,
): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]),
      { provide: VAULT_SOURCE, useFactory: () => new InMemoryVaultSource(TEST_FILES) },
    ],
  }).compileComponents();

  document.documentElement.dataset['theme'] = theme;
  const fixture = TestBed.createComponent(component);
  await settle(fixture);

  // Guard against auditing the loading/skeleton state: the audit only counts
  // once the view provably rendered its content.
  const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
  expect(text).toContain(loadedMarker);

  const results = await axe.run(fixture.nativeElement as HTMLElement, {
    rules: { 'color-contrast': { enabled: false } },
  });
  const violations = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`);
  expect(violations).toEqual([]);
}

describe('AXE accessibility audit', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    delete document.documentElement.dataset['theme'];
  });

  // Each view's marker is text that only exists once its data has loaded
  // (the reader, opened without a path, legitimately audits its empty state).
  const views: [string, Type<unknown>, string][] = [
    ['app shell', App, 'A11y Test Vault'],
    ['wiki', WikiView, 'welcome.md'],
    ['board', BoardView, 'T-001'],
    ['cards', CardsView, 'T-001'],
    ['graph', GraphView, 'T-002'],
    ['reader', ReaderView, 'No file selected'],
  ];

  for (const theme of ['mos-paper', 'mos-carbon']) {
    for (const [name, component, loadedMarker] of views) {
      it(`${name} has no AXE violations under ${theme}`, async () => {
        await renderAndAudit(component, theme, loadedMarker);
      });
    }
  }

  // The card page is id-addressed (`/card/:id`), so it audits through a router
  // harness rather than the bare-component loop above.
  for (const theme of ['mos-paper', 'mos-carbon']) {
    it(`card page has no AXE violations under ${theme}`, async () => {
      await TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: 'card/:id', component: CardView }]),
          { provide: VAULT_SOURCE, useFactory: () => new InMemoryVaultSource(TEST_FILES) },
        ],
      }).compileComponents();

      document.documentElement.dataset['theme'] = theme;
      const harness = await RouterTestingHarness.create('/card/T-001');
      await settle(harness.fixture);

      const el = harness.routeNativeElement as HTMLElement;
      expect(el.textContent ?? '').toContain('First task');

      const results = await axe.run(el, { rules: { 'color-contrast': { enabled: false } } });
      const violations = results.violations.map(
        (v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`,
      );
      expect(violations).toEqual([]);
    });
  }

  // The side peek is a dialog overlaid on the board/cards views; audit it open
  // (F-021-S-03) since the peek-open state is where its ARIA (role/modal/name)
  // must hold.
  const peekHosts: [string, string, Type<unknown>][] = [
    ['board', '/board?peek=T-001', BoardView],
    ['cards', '/cards?peek=T-001', CardsView],
  ];
  for (const theme of ['mos-paper', 'mos-carbon']) {
    for (const [name, url, component] of peekHosts) {
      it(`${name} with the side peek open has no AXE violations under ${theme}`, async () => {
        await TestBed.configureTestingModule({
          providers: [
            provideRouter([{ path: name, component }]),
            { provide: VAULT_SOURCE, useFactory: () => new InMemoryVaultSource(TEST_FILES) },
          ],
        }).compileComponents();

        document.documentElement.dataset['theme'] = theme;
        const harness = await RouterTestingHarness.create(url);
        await settle(harness.fixture);

        const el = harness.routeNativeElement as HTMLElement;
        expect(el.querySelector('[role="dialog"]')).not.toBeNull();
        expect(el.textContent ?? '').toContain('First task');

        const results = await axe.run(el, { rules: { 'color-contrast': { enabled: false } } });
        const violations = results.violations.map(
          (v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`,
        );
        expect(violations).toEqual([]);
      });
    }
  }

  // Swimlanes (F-034): the lane grid must be AXE-clean both collapsed (the
  // default portfolio view) and expanded, under both themes — the lane-header
  // controls (collapse toggle, peek button, progress) are new ARIA surface.
  const baseConfig = JSON.parse(TEST_CONFIG);
  const LANE_FILES: Record<string, string> = {
    ...TEST_FILES,
    '.mos/config.json': JSON.stringify({
      ...baseConfig,
      board: { ...baseConfig.board, laneField: 'parent' },
    }),
  };
  const laneStates: [string, string][] = [
    ['collapsed', '/board'],
    ['expanded', '/board?expand=T-001'],
  ];
  for (const theme of ['mos-paper', 'mos-carbon']) {
    for (const [state, url] of laneStates) {
      it(`board swimlanes (${state}) have no AXE violations under ${theme}`, async () => {
        await TestBed.configureTestingModule({
          providers: [
            provideRouter([{ path: 'board', component: BoardView }]),
            { provide: VAULT_SOURCE, useFactory: () => new InMemoryVaultSource(LANE_FILES) },
          ],
        }).compileComponents();

        document.documentElement.dataset['theme'] = theme;
        const harness = await RouterTestingHarness.create(url);
        await settle(harness.fixture);

        const el = harness.routeNativeElement as HTMLElement;
        // The container renders as a lane header in both states.
        expect(el.textContent ?? '').toContain('First task');

        const results = await axe.run(el, { rules: { 'color-contrast': { enabled: false } } });
        const violations = results.violations.map(
          (v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`,
        );
        expect(violations).toEqual([]);
      });
    }
  }
});
