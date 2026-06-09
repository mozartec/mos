import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { VaultSource } from '@mos/core';
import { ReaderView } from './reader-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';

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
  'board/S-001.md': ['---', 'id: S-001', 'type: story', 'status: Todo', '---', '', '# Story one', '', 'See S-002.'].join('\n'),
  'board/S-002.md': ['---', 'id: S-002', 'type: story', 'status: Todo', '---', '', '# Story two'].join('\n'),
};

class TestVaultSource implements VaultSource {
  listFiles(): Promise<string[]> {
    return Promise.resolve(Object.keys(FILES));
  }
  readFile(path: string): Promise<string> {
    const content = FILES[path];
    return content === undefined
      ? Promise.reject(new Error(`No such file: ${path}`))
      : Promise.resolve(content);
  }
  watch(): () => void {
    return () => undefined;
  }
}

describe('ReaderView', () => {
  /** Drain the queued microtask/macrotask rounds of the view's async init. */
  async function settle(harness: RouterTestingHarness) {
    for (let i = 0; i < 5; i++) {
      await harness.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    harness.detectChanges();
  }

  async function openReader(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'reader', component: ReaderView }]),
        { provide: VAULT_SOURCE, useClass: TestVaultSource },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    await settle(harness);
    return harness;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders the file named by the path query param with the shared reader', async () => {
    const harness = await openReader('/reader?path=board/S-001.md&from=board');
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('app-markdown-reader')).not.toBeNull();
    expect(el.textContent).toContain('Story one');
  });

  it('back control returns to the board preserving the sprint filter', async () => {
    const harness = await openReader('/reader?path=board/S-001.md&from=board&sprint=S1');
    const el = harness.routeNativeElement as HTMLElement;
    const back = el.querySelector('a.btn') as HTMLAnchorElement;
    expect(back.textContent).toContain('Back to Board');
    expect(back.getAttribute('href')).toBe('/board?sprint=S1');
  });

  it('back control defaults to the wiki when not opened from the board', async () => {
    const harness = await openReader('/reader?path=board/S-001.md');
    const el = harness.routeNativeElement as HTMLElement;
    const back = el.querySelector('a.btn') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('/wiki');
  });

  it('internal navigation swaps the path query param and keeps from/sprint', async () => {
    const harness = await openReader('/reader?path=board/S-001.md&from=board&sprint=S1');
    const component = harness.routeDebugElement!.componentInstance as ReaderView;
    component['onNavigate']('board/S-002.md');
    await settle(harness);
    const router = TestBed.inject(Router);
    expect(router.url).toContain('path=board%2FS-002.md');
    expect(router.url).toContain('from=board');
    expect(router.url).toContain('sprint=S1');
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.textContent).toContain('Story two');
  });

  it('shows a visible error when the file cannot be read', async () => {
    const harness = await openReader('/reader?path=board/MISSING.md');
    const el = harness.routeNativeElement as HTMLElement;
    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('board/MISSING.md');
  });
});
