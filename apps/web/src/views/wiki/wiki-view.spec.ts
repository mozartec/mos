import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, provideRouter } from '@angular/router';
import { WikiView } from './wiki-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { InMemoryVaultSource, settle } from '../../testing/test-helpers';

/** Minimal vault config that includes all .md files and excludes apps/**. */
const TEST_CONFIG = JSON.stringify({
  specVersion: '0.2',
  wiki: {
    include: ['**/*.md'],
    exclude: ['apps/**'],
  },
  board: { include: ['board/**/*.md'], columns: [] },
  types: {},
});

/** The wiki fixture files served by the in-memory source. */
const WIKI_FILES: Record<string, string> = {
  '.mos/config.json': TEST_CONFIG,
  'board/T-001-sample.md': [
    '---',
    'id: T-001',
    'type: task',
    'status: Done',
    '---',
    '',
    '# Sample task',
    '',
    'A body line.',
  ].join('\n'),
  'docs/intro.md': '# Intro\n\nIntroduction.',
  // This path should be excluded by the config (apps/**).
  'apps/web/README.md': '# App readme',
};

describe('WikiView', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WikiView],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        // Clone per test: one spec simulates a file edit by mutating the map.
        { provide: VAULT_SOURCE, useFactory: () => new InMemoryVaultSource({ ...WIKI_FILES }) },
      ],
    }).compileComponents();
  });

  it('renders only markdown body content for files with frontmatter', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sample task');
    expect(text).not.toContain('id: T-001');
    expect(text).not.toContain('type: task');
  });

  it('uses the shared markdown reader component', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-markdown-reader').length).toBe(1);
  });

  it('renders folder rows for grouped files', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    // 'board' and 'docs' folders should appear as treeitem buttons
    const items = Array.from(host.querySelectorAll('[role="treeitem"]')) as HTMLElement[];
    const names = items.map((el) => el.textContent?.trim() ?? '');
    expect(names.some((n) => n.includes('board/'))).toBe(true);
    expect(names.some((n) => n.includes('docs/'))).toBe(true);
  });

  it('does not show excluded paths (apps/**) in the tree', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    // The excluded file 'apps/web/README.md' must not appear
    expect(text).not.toContain('apps/');
    expect(text).not.toContain('App readme');
  });

  it("auto-expands the initial file's ancestor folders on load", async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    // board/ should be expanded because T-001-sample.md is the first selected file
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('T-001-sample.md');
  });

  it('expands a collapsed folder and reveals its children when toggled', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    // Find the 'docs/' folder toggle (it starts collapsed)
    const items = Array.from(host.querySelectorAll('[role="treeitem"]')) as HTMLElement[];
    const docsItem = items.find((el) => el.textContent?.trim().includes('docs/'));
    expect(docsItem).toBeDefined();

    // Click to expand
    docsItem!.click();
    fixture.detectChanges();

    // The file inside 'docs/' should now be visible
    expect(host.textContent ?? '').toContain('intro.md');
  });

  it('marks the selected file treeitem as aria-selected="true"', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    // board/ is already expanded; select the board file
    await component['select']('board/T-001-sample.md');
    fixture.detectChanges();

    const items = Array.from(host.querySelectorAll('[role="treeitem"]')) as HTMLElement[];
    const fileItem = items.find((el) => el.textContent?.trim().includes('T-001-sample.md'));
    expect(fileItem).toBeDefined();
    expect(fileItem!.getAttribute('aria-selected')).toBe('true');
  });

  it('sets aria-level, aria-setsize, and aria-posinset on treeitems', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    // board/ folder is at depth 0 — aria-level should be 1
    const items = Array.from(host.querySelectorAll('[role="treeitem"]')) as HTMLElement[];
    const boardFolder = items.find((el) => el.textContent?.trim().includes('board/'));
    expect(boardFolder).toBeDefined();
    expect(boardFolder!.getAttribute('aria-level')).toBe('1');

    // board/ and docs/ are siblings at root — setsize should be 2
    expect(boardFolder!.getAttribute('aria-setsize')).toBe('2');

    // T-001-sample.md is inside board/ (depth 1) — aria-level should be 2
    const fileItem = items.find((el) => el.textContent?.trim().includes('T-001-sample.md'));
    expect(fileItem).toBeDefined();
    expect(fileItem!.getAttribute('aria-level')).toBe('2');
  });

  it('implements keyboard ArrowDown / ArrowUp navigation', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    const items = Array.from(host.querySelectorAll('[role="treeitem"]')) as HTMLElement[];

    // Initial focused index is 0
    expect(component['focusedIndex']()).toBe(0);

    // ArrowDown should move focus to index 1
    items[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(component['focusedIndex']()).toBe(1);

    // ArrowUp should move focus back to index 0
    items[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    expect(component['focusedIndex']()).toBe(0);
  });

  it('implements keyboard ArrowRight to expand a folder', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    // docs/ folder is the second treeitem (board/ is first, expanded)
    // We find docs/ by navigating — use ArrowDown from the file inside board
    // to reach docs/ and then expand it via ArrowRight
    const items = Array.from(host.querySelectorAll('[role="treeitem"]')) as HTMLElement[];
    const docsItem = items.find((el) => el.textContent?.trim().includes('docs/'));
    expect(docsItem).toBeDefined();
    const docsIndex = items.indexOf(docsItem!);

    // Confirm docs is collapsed
    expect(docsItem!.getAttribute('aria-expanded')).toBe('false');

    // Press ArrowRight on the docs folder to expand it
    docsItem!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    // docs/ should now be expanded
    expect(component['expandedFolders']().has('docs')).toBe(true);

    // Focus should move to the first child
    expect(component['focusedIndex']()).toBe(docsIndex + 1);
  });

  it('implements keyboard ArrowLeft to collapse a folder', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    // board/ is auto-expanded on load — find it and collapse with ArrowLeft
    const items = Array.from(host.querySelectorAll('[role="treeitem"]')) as HTMLElement[];
    const boardItem = items.find((el) => el.textContent?.trim().includes('board/'));
    expect(boardItem).toBeDefined();

    boardItem!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    fixture.detectChanges();

    expect(component['expandedFolders']().has('board')).toBe(false);
  });

  // ── Acceptance F-005 / F-005-S-01: live re-render on file change ──────────

  it('re-renders the open file when it changes on disk, without a refresh', async () => {
    const fixture = TestBed.createComponent(WikiView);
    for (let i = 0; i < 5; i++) {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    fixture.detectChanges();

    // The first wiki file (board/T-001-sample.md) is auto-selected on load.
    expect(fixture.nativeElement.textContent).toContain('A body line.');

    const source = TestBed.inject(VAULT_SOURCE) as InMemoryVaultSource;
    source.files['board/T-001-sample.md'] = [
      '---',
      'id: T-001',
      'type: task',
      'status: Done',
      '---',
      '',
      '# Sample task',
      '',
      'An updated body line.',
    ].join('\n');
    source.emit('board/T-001-sample.md');
    for (let i = 0; i < 5; i++) {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('An updated body line.');
    expect(text).not.toContain('A body line.');
  });

  // ── Acceptance F-017: link clicks push history; back returns to the source ─

  it('opens a reader link via the path query param (history entry)', async () => {
    const router = TestBed.inject(Router);
    router.initialNavigation();
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);

    // Initial auto-selection seeds the URL without growing history.
    expect(fixture.componentInstance['selectedPath']()).toBe('board/T-001-sample.md');

    fixture.componentInstance['openFromLink']('docs/intro.md');
    await settle(fixture);

    expect(fixture.componentInstance['selectedPath']()).toBe('docs/intro.md');
    expect(fixture.nativeElement.textContent).toContain('Introduction.');
    expect(TestBed.inject(Location).path()).toContain('path=docs%2Fintro.md');
  });

  it('browser back returns to the source page after a link click', async () => {
    const router = TestBed.inject(Router);
    router.initialNavigation();
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);

    fixture.componentInstance['openFromLink']('docs/intro.md');
    await settle(fixture);
    expect(fixture.componentInstance['selectedPath']()).toBe('docs/intro.md');

    TestBed.inject(Location).back();
    await settle(fixture);

    expect(fixture.componentInstance['selectedPath']()).toBe('board/T-001-sample.md');
    expect(fixture.nativeElement.textContent).toContain('A body line.');
  });

  it('deep-links a file from the path query param on load', async () => {
    const router = TestBed.inject(Router);
    router.initialNavigation();
    await router.navigate([], { queryParams: { path: 'docs/intro.md' } });
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);

    expect(fixture.componentInstance['selectedPath']()).toBe('docs/intro.md');
    expect(fixture.nativeElement.textContent).toContain('Introduction.');
  });
});

// ── F-036-S-02: search in the wiki lens ──────────────────────────────────────

/** Wiki excludes the board folder, so All / Wiki / Board narrow to distinct sets. */
const SEARCH_CONFIG = JSON.stringify({
  specVersion: '0.4',
  wiki: { include: ['**/*.md'], exclude: ['board/**'] },
  board: { include: ['board/**/*.md'], columns: [] },
  types: {},
});

const SEARCH_FILES: Record<string, string> = {
  '.mos/config.json': SEARCH_CONFIG,
  'docs/guide.md': '# Guide\n\nThe aardvark forages at dusk.',
  'docs/other.md': '# Other\n\nNothing notable here.',
  'board/T-100.md': [
    '---',
    'id: T-100',
    'type: task',
    'title: Aardvark card',
    'status: Todo',
    '---',
    '',
    '# T-100',
    '',
    'A board note about the aardvark.',
  ].join('\n'),
};

function combobox(host: HTMLElement): HTMLInputElement {
  return host.querySelector('input[role="combobox"]') as HTMLInputElement;
}

/** Simulate typing into the search box (drives `?q=` through the URL). */
function typeQuery(host: HTMLElement, q: string): void {
  const input = combobox(host);
  input.value = q;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function options(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll('[role="option"]'));
}

describe('WikiView — search (F-036-S-02)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WikiView],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: VAULT_SOURCE, useFactory: () => new InMemoryVaultSource({ ...SEARCH_FILES }) },
      ],
    }).compileComponents();
    TestBed.inject(Router).initialNavigation();
  });

  it('shows scoped body snippets with <mark> while searching, and restores the tree on clear', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;

    // The file tree is shown until a query is entered.
    expect(host.querySelector('[role="tree"]')).not.toBeNull();
    expect(host.querySelector('[role="listbox"]')).toBeNull();

    typeQuery(host, 'aardvark');
    await settle(fixture);

    expect(host.querySelector('[role="listbox"]')).not.toBeNull();
    expect(host.querySelector('[role="tree"]')).toBeNull();
    const marks = Array.from(host.querySelectorAll('mark')).map((m) => m.textContent);
    expect(marks).toContain('aardvark');

    // Clearing the query restores the file tree.
    typeQuery(host, '');
    await settle(fixture);
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(host.querySelector('[role="tree"]')).not.toBeNull();
  });

  it('narrows results by scope via the config globs (All / Wiki / Board), bookmarkable from ?q=&in=', async () => {
    const router = TestBed.inject(Router);

    // Deep-link a search from the URL: it renders results on load (bookmarkable).
    await router.navigate([], { queryParams: { q: 'aardvark', in: 'all' } });
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(options(host).length).toBe(2);

    await router.navigate([], { queryParams: { q: 'aardvark', in: 'board' } });
    await settle(fixture);
    expect(options(host).length).toBe(1);
    expect(options(host)[0]!.textContent).toContain('T-100.md');

    await router.navigate([], { queryParams: { q: 'aardvark', in: 'wiki' } });
    await settle(fixture);
    expect(options(host).length).toBe(1);
    expect(options(host)[0]!.textContent).toContain('guide.md');
  });

  it('picks a scope through the segmented control, writing ?in=', async () => {
    const router = TestBed.inject(Router);
    await router.navigate([], { queryParams: { q: 'aardvark' } });
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;

    const radios = Array.from(
      host.querySelectorAll('input[name="wiki-search-scope"]'),
    ) as HTMLInputElement[];
    expect(radios.length).toBe(3);

    const board = radios.find((r) => r.getAttribute('value') === 'board')!;
    board.checked = true;
    board.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(fixture);

    expect(TestBed.inject(Location).path()).toContain('in=board');
    expect(options(host).length).toBe(1);
  });

  it('opens a result in the content pane, carrying q in the URL (open in place)', async () => {
    const router = TestBed.inject(Router);
    await router.navigate([], { queryParams: { q: 'aardvark', in: 'board' } });
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;

    options(host)[0]!.click();
    await settle(fixture);

    expect(fixture.componentInstance['selectedPath']()).toBe('board/T-100.md');
    expect(host.querySelector('app-markdown-reader')).not.toBeNull();
    const path = TestBed.inject(Location).path();
    expect(path).toContain('path=board%2FT-100.md');
    expect(path).toContain('q=aardvark');
    // The sidebar stays on the results (q retained) — Obsidian model.
    expect(host.querySelector('[role="listbox"]')).not.toBeNull();
  });

  it('is keyboard operable: arrows move the active option, Enter opens, Esc clears', async () => {
    const router = TestBed.inject(Router);
    await router.navigate([], { queryParams: { q: 'aardvark', in: 'all' } });
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    const input = combobox(host);

    // Ranked: board/T-100 (title+body) first, docs/guide (body) second.
    expect(input.getAttribute('aria-activedescendant')).toBe('wiki-search-option-0');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle(fixture);
    expect(input.getAttribute('aria-activedescendant')).toBe('wiki-search-option-1');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(fixture);
    expect(fixture.componentInstance['selectedPath']()).toBe('docs/guide.md');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(fixture);
    expect(host.querySelector('[role="tree"]')).not.toBeNull();
    expect(host.querySelector('[role="listbox"]')).toBeNull();
  });

  it('shows an honest empty state and announces the count via aria-live', async () => {
    const router = TestBed.inject(Router);
    await router.navigate([], { queryParams: { q: 'zzznomatch' } });
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(host.textContent).toContain('No matches');
    const live = host.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('0 results');
  });

  it('keeps the active option in range when the result set shrinks via the URL (Back/Forward)', async () => {
    const router = TestBed.inject(Router);
    await router.navigate([], { queryParams: { q: 'aardvark', in: 'all' } });
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    const input = combobox(host);

    // Move the active option onto the 2nd result.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle(fixture);
    expect(input.getAttribute('aria-activedescendant')).toBe('wiki-search-option-1');

    // Narrow to a single result straight through the URL — bypasses the input
    // handlers (as browser Back/Forward would).
    await router.navigate([], { queryParams: { q: 'aardvark', in: 'board' } });
    await settle(fixture);

    expect(options(host).length).toBe(1);
    // aria-activedescendant points at a rendered option (not the vanished #1)…
    expect(input.getAttribute('aria-activedescendant')).toBe('wiki-search-option-0');
    // …and Enter opens it rather than no-opping on an out-of-range index.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(fixture);
    expect(fixture.componentInstance['selectedPath']()).toBe('board/T-100.md');
  });

  it('does not auto-open an arbitrary file for a search-only bookmark (?q= without ?path=)', async () => {
    const router = TestBed.inject(Router);
    await router.navigate([], { queryParams: { q: 'aardvark' } });
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);

    // No file auto-selected, and the URL stays search-only (no ?path= merged in).
    expect(fixture.componentInstance['selectedPath']()).toBeNull();
    expect(TestBed.inject(Location).path()).not.toContain('path=');
  });

  it('announces the opened file for screen readers (focus stays in the search box)', async () => {
    const router = TestBed.inject(Router);
    await router.navigate([], { queryParams: { q: 'aardvark', in: 'board' } });
    const fixture = TestBed.createComponent(WikiView);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;

    options(host)[0]!.click();
    await settle(fixture);

    const status = host.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Opened T-100.md');
  });
});
