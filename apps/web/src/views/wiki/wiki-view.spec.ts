import { TestBed } from '@angular/core/testing';
import type { VaultSource } from '@mos/core';
import { WikiView } from './wiki-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';

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

class TestVaultSource implements VaultSource {
  private readonly files: Record<string, string> = {
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

  listFiles(): Promise<string[]> {
    return Promise.resolve(Object.keys(this.files));
  }

  readFile(path: string): Promise<string> {
    const file = this.files[path];
    return file === undefined
      ? Promise.reject(new Error(`No such file: ${path}`))
      : Promise.resolve(file);
  }

  watch(): () => void {
    return () => undefined;
  }
}

describe('WikiView', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WikiView],
      providers: [{ provide: VAULT_SOURCE, useClass: TestVaultSource }],
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
    // 'board' and 'docs' folders should appear (both collapsed by default)
    const buttons = Array.from(host.querySelectorAll('button')) as HTMLButtonElement[];
    const folderNames = buttons.map((b) => b.textContent?.trim() ?? '');
    expect(folderNames.some((n) => n.includes('board/'))).toBe(true);
    expect(folderNames.some((n) => n.includes('docs/'))).toBe(true);
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

  it('expands a folder and reveals its children when toggled', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    // Find the 'board/' folder toggle button
    const buttons = Array.from(host.querySelectorAll('button')) as HTMLButtonElement[];
    const boardBtn = buttons.find((b) => b.textContent?.trim().includes('board/'));
    expect(boardBtn).toBeDefined();

    // Click to expand
    boardBtn!.click();
    fixture.detectChanges();

    // The file inside 'board/' should now be visible
    const updatedText = host.textContent ?? '';
    expect(updatedText).toContain('T-001-sample.md');
  });

  it('marks the selected file button as pressed', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    // Expand the board folder first
    const buttons = Array.from(host.querySelectorAll('button')) as HTMLButtonElement[];
    const boardBtn = buttons.find((b) => b.textContent?.trim().includes('board/'));
    boardBtn!.click();
    fixture.detectChanges();

    // Select the file
    await component['select']('board/T-001-sample.md');
    fixture.detectChanges();

    const updatedButtons = Array.from(host.querySelectorAll('button')) as HTMLButtonElement[];
    const fileBtn = updatedButtons.find((b) =>
      b.textContent?.trim().includes('T-001-sample.md'),
    );
    expect(fileBtn).toBeDefined();
    expect(fileBtn!.getAttribute('aria-pressed')).toBe('true');
  });
});
