import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CardView } from './card-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { InMemoryVaultSource, settle } from '../../testing/test-helpers';

const TEST_CONFIG = JSON.stringify({
  specVersion: '0.4',
  vault: { name: 'Test Vault' },
  wiki: { include: ['**/*.md'], exclude: [] },
  board: {
    include: ['board/**/*.md'],
    columns: ['Backlog', 'Planned', 'In Progress', 'Done'],
    sortWithinColumn: ['priority', 'id'],
  },
  references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*' },
  fields: {
    id: { type: 'id', label: 'ID' },
    priority: {
      type: 'enum',
      values: ['P0', 'P1', 'P2'],
      label: 'Priority',
      icon: 'flag',
      valueColors: { P1: 'amber' },
    },
    owner: { type: 'string', label: 'Owner', icon: 'user' },
    estimate: { type: 'enum', values: ['S', 'M', 'L'], label: 'Estimate' },
    parent: { type: 'id', label: 'Parent' },
    dependsOn: { type: 'id', list: true, label: 'Depends on' },
  },
  types: {
    feature: {
      label: 'Feature',
      parent: null,
      color: 'purple',
      states: { Draft: 'Backlog', Planned: 'Planned', 'In Progress': 'In Progress', Done: 'Done' },
      card: { fields: ['id', 'priority', 'owner', 'dependsOn'] },
    },
    story: {
      label: 'Story',
      parent: 'feature',
      color: 'green',
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
      card: { fields: ['id', 'parent', 'priority', 'owner', 'estimate', 'dependsOn'] },
    },
  },
});

function card(front: Record<string, string>, body: string): string {
  const lines = ['---', ...Object.entries(front).map(([k, v]) => `${k}: ${v}`), '---', '', body];
  return lines.join('\n');
}

const FILES: Record<string, string> = {
  '.mos/config.json': TEST_CONFIG,
  'board/F-001.md': card(
    { id: 'F-001', type: 'feature', title: 'Feature one', status: 'Planned' },
    '# Feature one',
  ),
  'board/S-000.md': card(
    { id: 'S-000', type: 'story', title: 'Dependency story', status: 'Done' },
    '# Dependency story',
  ),
  'board/S-001.md': card(
    {
      id: 'S-001',
      type: 'story',
      title: 'Story one',
      status: 'In Progress',
      priority: 'P1',
      owner: 'mozart',
      parent: 'F-001',
      dependsOn: '[S-000]',
    },
    '# Story one\n\nBody text mentioning S-002.',
  ),
  'board/S-002.md': card(
    { id: 'S-002', type: 'story', title: 'Story two', status: 'Done', parent: 'F-001' },
    '# Story two',
  ),
  'board/S-003.md': card(
    { id: 'S-003', type: 'story', title: 'Story three', status: 'Todo', dependsOn: '[S-001]' },
    '# Story three',
  ),
};

/** Stand-ins for the routes the card page links/falls through to. */
@Component({ selector: 'app-stub', template: 'stub' })
class StubView {}

async function openCard(url: string, files: Record<string, string> = FILES) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'card/:id', component: CardView },
        { path: 'board', component: StubView },
        { path: 'reader', component: StubView },
      ]),
      { provide: VAULT_SOURCE, useFactory: () => new InMemoryVaultSource(files) },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  await settle(harness.fixture);
  return harness;
}

describe('CardView', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders the card page on direct navigation: id, type, status, title, body', async () => {
    const harness = await openCard('/card/S-001');
    const el = harness.routeNativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('S-001');
    expect(text).toContain('Story'); // type badge label
    expect(text).toContain('In Progress'); // status chip
    expect(el.querySelector('h1')?.textContent).toContain('Story one');
    expect(el.querySelector('app-markdown-reader')).not.toBeNull();
    expect(text).toContain('Body text mentioning');
  });

  it('header shows the type configured fields (priority, owner)', async () => {
    const harness = await openCard('/card/S-001');
    const header = (harness.routeNativeElement as HTMLElement).querySelector('header');
    const headerText = header?.textContent ?? '';
    expect(headerText).toContain('Priority');
    expect(headerText).toContain('P1');
    expect(headerText).toContain('Owner');
    expect(headerText).toContain('mozart');
  });

  it('lists relations: parent, dependency with status, and dependent', async () => {
    const harness = await openCard('/card/S-001');
    const el = harness.routeNativeElement as HTMLElement;
    const links = Array.from(el.querySelectorAll('app-relation-link button')).map(
      (b) => b.textContent ?? '',
    );
    // Parent breadcrumb, the dependency (with its Done status), and the dependent.
    expect(links.some((t) => t.includes('F-001') && t.includes('Feature one'))).toBe(true);
    expect(links.some((t) => t.includes('S-000') && t.includes('Done'))).toBe(true);
    expect(links.some((t) => t.includes('S-003'))).toBe(true);
  });

  it('shows children with a progress summary on a container card', async () => {
    const harness = await openCard('/card/F-001');
    const el = harness.routeNativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('Children');
    expect(text).toContain('1/2 done'); // S-002 Done of {S-001, S-002}
    const links = Array.from(el.querySelectorAll('app-relation-link button')).map(
      (b) => b.textContent ?? '',
    );
    expect(links.some((t) => t.includes('S-001'))).toBe(true);
    expect(links.some((t) => t.includes('S-002'))).toBe(true);
  });

  it('clicking a relation navigates to that card page, keeping the back-trail', async () => {
    const harness = await openCard('/card/S-001?from=board&scope=S2');
    const el = harness.routeNativeElement as HTMLElement;
    const parentBtn = Array.from(el.querySelectorAll('app-relation-link button')).find((b) =>
      (b.textContent ?? '').includes('F-001'),
    ) as HTMLButtonElement;
    parentBtn.click();
    await settle(harness.fixture);
    const router = TestBed.inject(Router);
    expect(router.url).toContain('/card/F-001');
    expect(router.url).toContain('from=board');
    expect(router.url).toContain('scope=S2');
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'Feature one',
    );
  });

  it('an in-body card link routes to that card page', async () => {
    const harness = await openCard('/card/S-001');
    const component = harness.routeDebugElement!.componentInstance as CardView;
    component['onBodyNavigate']('board/S-002.md');
    await settle(harness.fixture);
    expect(TestBed.inject(Router).url).toContain('/card/S-002');
  });

  it('an in-body doc link falls through to the reader, carrying the back-trail', async () => {
    const harness = await openCard('/card/S-001?from=board&scope=S2');
    const component = harness.routeDebugElement!.componentInstance as CardView;
    component['onBodyNavigate']('docs/vision.md'); // resolves to no card
    await settle(harness.fixture);
    const url = TestBed.inject(Router).url;
    expect(url).toContain('/reader');
    expect(url).toContain('path=docs%2Fvision.md');
    expect(url).toContain('from=board');
    expect(url).toContain('scope=S2');
  });

  it('back control restores the board scope and filters it was opened from', async () => {
    const harness = await openCard('/card/S-001?from=board&scope=S2&priority=P0');
    const back = (harness.routeNativeElement as HTMLElement).querySelector(
      'a.btn',
    ) as HTMLAnchorElement;
    expect(back.textContent).toContain('Back to Board');
    const href = back.getAttribute('href') ?? '';
    expect(href.startsWith('/board?')).toBe(true);
    expect(href).toContain('scope=S2');
    expect(href).toContain('priority=P0');
  });

  it('back control restores the cards lens filters and sort it was opened from (F-020)', async () => {
    const harness = await openCard('/card/S-001?from=cards&type=story&sort=-priority');
    const back = (harness.routeNativeElement as HTMLElement).querySelector(
      'a.btn',
    ) as HTMLAnchorElement;
    expect(back.textContent).toContain('Back to Cards');
    const href = back.getAttribute('href') ?? '';
    expect(href.startsWith('/cards?')).toBe(true);
    expect(href).toContain('type=story');
    expect(href).toContain('sort=-priority');
    expect(href).not.toContain('from=');
  });

  it('shows a clear miss for an id that names no card', async () => {
    const harness = await openCard('/card/NOPE');
    const alert = (harness.routeNativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No card with id');
    expect(alert?.textContent).toContain('NOPE');
  });

  it('renders a vault with a different vocabulary unchanged (config-driven)', async () => {
    const recipeConfig = JSON.stringify({
      specVersion: '0.4',
      vault: { name: 'Recipes' },
      wiki: { include: ['**/*.md'], exclude: [] },
      board: { include: ['recipes/**/*.md'], columns: ['Idea', 'Cooked'] },
      references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
      fields: {
        id: { type: 'id', label: 'ID' },
        difficulty: { type: 'enum', values: ['Easy', 'Hard'], label: 'Difficulty' },
      },
      types: {
        recipe: {
          parent: null,
          states: { Idea: 'Idea', Cooked: 'Cooked' },
          card: { fields: ['id', 'difficulty'] },
        },
      },
    });
    const recipeFiles: Record<string, string> = {
      '.mos/config.json': recipeConfig,
      'recipes/R-1.md': card(
        { id: 'R-1', type: 'recipe', title: 'Pancakes', status: 'Idea', difficulty: 'Easy' },
        '# Pancakes',
      ),
    };
    const harness = await openCard('/card/R-1', recipeFiles);
    const el = harness.routeNativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(el.querySelector('h1')?.textContent).toContain('Pancakes');
    expect(text).toContain('R-1');
    expect(text).toContain('Difficulty');
    expect(text).toContain('Easy');
    expect(text).toContain('Idea'); // status chip from the recipe vocabulary
  });
});
