import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { buildModel, loadConfig, parseFile, type VaultConfig, type VaultModel } from '@mos/core';
import { CardPeek } from './card-peek';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { InMemoryVaultSource, settle } from '../../testing/test-helpers';

const CONFIG = JSON.stringify({
  specVersion: '0.4',
  vault: { name: 'Peek Test' },
  wiki: { include: ['**/*.md'], exclude: [] },
  board: { include: ['board/**/*.md'], columns: ['Backlog', 'In Progress', 'Done'] },
  references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
  fields: {
    id: { type: 'id', label: 'ID' },
    priority: { type: 'enum', values: ['P0', 'P1'], label: 'Priority' },
    parent: { type: 'id', label: 'Parent' },
    dependsOn: { type: 'id', list: true, label: 'Depends on' },
  },
  types: {
    story: {
      label: 'Story',
      parent: null,
      color: 'green',
      states: { Todo: 'Backlog', 'In Progress': 'In Progress', Done: 'Done' },
      card: { fields: ['id', 'priority', 'dependsOn'] },
    },
  },
});

function card(front: Record<string, string>, body: string): string {
  const lines = ['---', ...Object.entries(front).map(([k, v]) => `${k}: ${v}`), '---', '', body];
  return lines.join('\n');
}

const FILES: Record<string, string> = {
  'board/A.md': card(
    { id: 'A-1', type: 'story', title: 'Alpha', status: 'Todo', dependsOn: '[A-2]' },
    '# Alpha\n\nThe body text of Alpha.',
  ),
  'board/B.md': card({ id: 'A-2', type: 'story', title: 'Beta', status: 'Done' }, '# Beta'),
};

/** Host that drives the peek the way the board does: a trigger + the overlay. */
@Component({
  selector: 'app-peek-host',
  template: `
    <button id="trigger" type="button">trigger</button>
    <app-card-peek
      [cardId]="cardId()"
      [model]="model"
      [config]="config"
      (closePeek)="events.closed = events.closed + 1"
      (expand)="events.expanded = $event"
      (peekCard)="events.peeked = $event"
      (openDoc)="events.doc = $event"
    />
  `,
  imports: [CardPeek],
})
class PeekHost {
  readonly cardId = signal<string | null>(null);
  model!: VaultModel;
  config!: VaultConfig;
  events = { closed: 0, expanded: '', peeked: '', doc: '' };
}

const attached: HTMLElement[] = [];

async function createHost(
  initial: string | null = null,
  sourceFiles: Record<string, string> = FILES,
) {
  TestBed.configureTestingModule({
    providers: [{ provide: VAULT_SOURCE, useValue: new InMemoryVaultSource(sourceFiles) }],
  });
  const fixture = TestBed.createComponent(PeekHost);
  // Attach to the document so focus (document.activeElement) behaves for real.
  document.body.appendChild(fixture.nativeElement);
  attached.push(fixture.nativeElement);

  const { config } = loadConfig(CONFIG);
  fixture.componentInstance.config = config;
  fixture.componentInstance.model = buildModel(
    Object.entries(FILES).map(([path, text]) => parseFile(path, text)),
    config,
  ).model;
  fixture.componentInstance.cardId.set(initial);
  await settle(fixture);
  return fixture;
}

describe('CardPeek', () => {
  afterEach(() => {
    for (const el of attached.splice(0)) el.remove();
    TestBed.resetTestingModule();
  });

  it('is a focus-trapped modal that restores focus to the trigger on close', async () => {
    const fixture = await createHost();
    const host = fixture.nativeElement as HTMLElement;
    const trigger = host.querySelector('#trigger') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open: a modal dialog, with the trigger captured for restore.
    fixture.componentInstance.cardId.set('A-1');
    await settle(fixture);
    const panel = host.querySelector('.peek-panel') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('aria-modal')).toBe('true');

    // Move focus inside the trapped region (jsdom has no layout, so the auto
    // initial-focus can't pick a tabbable; we place it as a user's Tab would).
    const inside = panel.querySelector('button') as HTMLButtonElement;
    inside.focus();
    expect(panel.contains(document.activeElement)).toBe(true);

    // Close: the dialog is gone and focus returned to the triggering element.
    fixture.componentInstance.cardId.set(null);
    await settle(fixture);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('hosts the shared detail surface: title, body, and a dialog name', async () => {
    const fixture = await createHost('A-1');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-card-detail')).not.toBeNull();
    expect(host.querySelector('h1')?.textContent).toContain('Alpha');
    expect(host.textContent).toContain('The body text of Alpha.');
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Alpha');
  });

  it('shows a clear miss for an id no card carries', async () => {
    const fixture = await createHost('NOPE');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('No card with id');
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Card NOPE');
  });

  it('surfaces a read error when the card file cannot be read', async () => {
    // The model knows A-1 (path board/A.md), but the source lacks that file.
    const fixture = await createHost('A-1', { 'board/B.md': FILES['board/B.md'] });
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toContain("Couldn't read");
  });

  it('the expand and close controls emit to the host', async () => {
    const fixture = await createHost('A-1');
    const host = fixture.nativeElement as HTMLElement;
    const expandBtn = Array.from(host.querySelectorAll('.peek-panel button')).find((b) =>
      (b.textContent ?? '').includes('Expand'),
    ) as HTMLButtonElement;
    const closeBtn = host.querySelector(
      '.peek-panel button[aria-label="Close peek"]',
    ) as HTMLButtonElement;

    expandBtn.click();
    expect(fixture.componentInstance.events.expanded).toBe('A-1');
    closeBtn.click();
    expect(fixture.componentInstance.events.closed).toBe(1);
  });

  it('a relation click asks the host to peek that card (stays in the peek)', async () => {
    const fixture = await createHost('A-1');
    const host = fixture.nativeElement as HTMLElement;
    const relBtn = Array.from(host.querySelectorAll('app-relation-link button')).find((b) =>
      (b.textContent ?? '').includes('A-2'),
    ) as HTMLButtonElement;

    relBtn.click();
    await settle(fixture);
    expect(fixture.componentInstance.events.peeked).toBe('A-2');
  });

  it('routes an in-body link: a board card swaps the peek, a doc leaves for the reader', async () => {
    const fixture = await createHost('A-1');
    const peek = fixture.debugElement.query(By.directive(CardPeek)).componentInstance as CardPeek;

    peek['onBodyNavigate']('board/B.md'); // resolves to A-2
    expect(fixture.componentInstance.events.peeked).toBe('A-2');

    peek['onBodyNavigate']('docs/guide.md'); // resolves to no card
    expect(fixture.componentInstance.events.doc).toBe('docs/guide.md');
  });
});
