import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { buildModel, loadConfig, parseFile, type VaultConfig, type VaultModel } from '@mos/core';
import { CardDetail } from './card-detail';

const CONFIG_TEXT = JSON.stringify({
  specVersion: '0.4',
  wiki: { include: ['**/*.md'], exclude: [] },
  board: { include: ['board/**/*.md'], columns: ['Backlog', 'Done'] },
  references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+' },
  fields: {
    id: { type: 'id', label: 'ID' },
    dependsOn: { type: 'id', list: true, label: 'Depends on' },
  },
  types: {
    task: {
      parent: null,
      states: { Todo: 'Backlog', Done: 'Done' },
      card: { fields: ['id', 'dependsOn'] },
    },
  },
});

function makeModel(): { model: VaultModel; config: VaultConfig } {
  const { config } = loadConfig(CONFIG_TEXT);
  const files = [
    [
      'board/T-001.md',
      '---\nid: T-001\ntype: task\ntitle: Main\nstatus: Todo\ndependsOn: [T-002, T-404]\n---\n\n# Main',
    ],
    [
      'board/T-002.md',
      '---\nid: T-002\ntype: task\ntitle: A dependency\nstatus: Done\n---\n\n# Dep',
    ],
  ].map(([path, text]) => parseFile(path, text));
  const { model } = buildModel(files, config);
  return { model, config };
}

describe('CardDetail', () => {
  let fixture: ComponentFixture<CardDetail>;
  let model: VaultModel;
  let config: VaultConfig;

  function render(bodyError = ''): HTMLElement {
    ({ model, config } = makeModel());
    fixture = TestBed.createComponent(CardDetail);
    fixture.componentRef.setInput('card', model.cards['T-001']);
    fixture.componentRef.setInput('model', model);
    fixture.componentRef.setInput('config', config);
    fixture.componentRef.setInput('body', '# Main');
    fixture.componentRef.setInput('bodyError', bodyError);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders a resolved dependency as a button with its status', () => {
    const el = render();
    const button = Array.from(el.querySelectorAll('app-relation-link button')).find((b) =>
      (b.textContent ?? '').includes('T-002'),
    );
    expect(button).toBeTruthy();
    expect(button?.textContent).toContain('Done');
  });

  it('renders an unresolved dependency id inert, never as a dead link', () => {
    const el = render();
    const inert = el.querySelector('.reference-inert');
    expect(inert?.textContent).toContain('T-404');
    // No clickable control carries the dangling id.
    const buttons = Array.from(el.querySelectorAll('app-relation-link button')).map(
      (b) => b.textContent ?? '',
    );
    expect(buttons.some((t) => t.includes('T-404'))).toBe(false);
  });

  it('emits relationNavigate with the card id when a relation is activated', () => {
    const el = render();
    let emitted: string | undefined;
    fixture.componentInstance.relationNavigate.subscribe((id) => (emitted = id));
    const button = Array.from(el.querySelectorAll('app-relation-link button')).find((b) =>
      (b.textContent ?? '').includes('T-002'),
    ) as HTMLButtonElement;
    button.click();
    expect(emitted).toBe('T-002');
  });

  it('shows a body error instead of the reader when the body is unreadable', () => {
    const el = render("Couldn't read the file");
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Couldn't read");
    expect(el.querySelector('app-markdown-reader')).toBeNull();
  });
});
