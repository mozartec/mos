import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ReaderView } from './reader-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { InMemoryVaultSource, settle } from '../../testing/test-helpers';

const TEST_CONFIG = JSON.stringify({
  specVersion: '0.2',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: {
    include: ['board/**/*.md'],
    columns: ['Backlog', 'Done'],
    sortWithinColumn: ['priority', 'id'],
  },
  references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*' },
  types: {
    story: { label: 'Story', states: { Todo: 'Backlog', Done: 'Done' } },
  },
});

const FILES: Record<string, string> = {
  '.mos/config.json': TEST_CONFIG,
  'board/S-001.md': [
    '---',
    'id: S-001',
    'type: story',
    'status: Todo',
    '---',
    '',
    '# Story one',
  ].join('\n'),
  'docs/guide.md': ['# Guide', '', 'See the [other](other.md) doc.'].join('\n'),
  'docs/other.md': '# Other doc',
};

/** A stand-in for the lazy card page, so a redirect resolves to a real route. */
@Component({ selector: 'app-stub-card', template: 'card-page-stub' })
class StubCardView {}

describe('ReaderView', () => {
  async function openReader(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'reader', component: ReaderView },
          { path: 'card/:id', component: StubCardView },
        ]),
        { provide: VAULT_SOURCE, useFactory: () => new InMemoryVaultSource(FILES) },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    await settle(harness.fixture);
    return harness;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('redirects a board-card deep link to the card page, carrying from + board state', async () => {
    await openReader('/reader?path=board/S-001.md&from=board&scope=S2&priority=P0');
    const router = TestBed.inject(Router);
    expect(router.url).toContain('/card/S-001');
    expect(router.url).toContain('from=board');
    expect(router.url).toContain('scope=S2');
    expect(router.url).toContain('priority=P0');
    // The card id replaces the path param — it isn't carried onto the card route.
    expect(router.url).not.toContain('path=');
  });

  it('renders a wiki doc with the shared reader (docs still open here)', async () => {
    const harness = await openReader('/reader?path=docs/guide.md');
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('app-markdown-reader')).not.toBeNull();
    expect(el.textContent).toContain('Guide');
  });

  it('back control defaults to the wiki when not opened from the board', async () => {
    const harness = await openReader('/reader?path=docs/guide.md');
    const el = harness.routeNativeElement as HTMLElement;
    const back = el.querySelector('a.btn') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('/wiki');
  });

  it('an in-reader link to a board card opens the card page, keeping the back-trail', async () => {
    const harness = await openReader('/reader?path=docs/guide.md&from=board&scope=S2');
    const component = harness.routeDebugElement!.componentInstance as ReaderView;
    component['onNavigate']('board/S-001.md');
    await settle(harness.fixture);
    const router = TestBed.inject(Router);
    expect(router.url).toContain('/card/S-001');
    expect(router.url).toContain('from=board');
    expect(router.url).toContain('scope=S2');
    expect(router.url).not.toContain('path=');
  });

  it('internal navigation between docs swaps the path query param', async () => {
    const harness = await openReader('/reader?path=docs/guide.md');
    const component = harness.routeDebugElement!.componentInstance as ReaderView;
    component['onNavigate']('docs/other.md');
    await settle(harness.fixture);
    const router = TestBed.inject(Router);
    expect(router.url).toContain('path=docs%2Fother.md');
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.textContent).toContain('Other doc');
  });

  it('shows a visible error when the file cannot be read', async () => {
    const harness = await openReader('/reader?path=docs/MISSING.md');
    const el = harness.routeNativeElement as HTMLElement;
    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('docs/MISSING.md');
  });
});
