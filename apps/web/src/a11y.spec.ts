import { TestBed } from '@angular/core/testing';
import type { Type } from '@angular/core';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import type { VaultSource } from '@mos/core';
import { App } from './app/app';
import { BoardView } from './views/board/board-view';
import { GraphView } from './views/graph/graph-view';
import { ReaderView } from './views/reader/reader-view';
import { WikiView } from './views/wiki/wiki-view';
import { VAULT_SOURCE } from './sources/vault-source.token';

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
  'board/T-002.md':
    '---\nid: T-002\ntype: task\ntitle: Second task\nstatus: In Progress\npriority: P1\ndependsOn: [T-001]\n---\n\n# T-002\n',
};

class StubVaultSource implements VaultSource {
  listFiles(): Promise<string[]> {
    return Promise.resolve(Object.keys(TEST_FILES));
  }
  readFile(path: string): Promise<string> {
    const content = TEST_FILES[path];
    return content === undefined
      ? Promise.reject(new Error(`No such file: ${path}`))
      : Promise.resolve(content);
  }
  watch(): () => void {
    return () => undefined;
  }
}

async function renderAndAudit(component: Type<unknown>, theme: string): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [provideRouter([]), { provide: VAULT_SOURCE, useClass: StubVaultSource }],
  }).compileComponents();

  document.documentElement.dataset['theme'] = theme;
  const fixture = TestBed.createComponent(component);
  // Drain the async vault loads the views kick off on creation.
  for (let i = 0; i < 5; i++) {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  fixture.detectChanges();

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

  const views: [string, Type<unknown>][] = [
    ['app shell', App],
    ['wiki', WikiView],
    ['board', BoardView],
    ['graph', GraphView],
    ['reader', ReaderView],
  ];

  for (const theme of ['mos-paper', 'mos-carbon']) {
    for (const [name, component] of views) {
      it(`${name} has no AXE violations under ${theme}`, async () => {
        await renderAndAudit(component, theme);
      });
    }
  }
});
