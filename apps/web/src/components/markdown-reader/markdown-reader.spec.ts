import { TestBed } from '@angular/core/testing';
import { MarkdownReader } from './markdown-reader';
import { type VaultConfig, type VaultModel } from '@mos/core';

const TEST_CONFIG: VaultConfig = {
  specVersion: '0.2',
  vault: { name: 'Test' },
  meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
  fields: {},
  wiki: { include: ['**/*.md'], exclude: [], fields: [] },
  board: { include: ['board/**/*.md'], columns: [], sortWithinColumn: ['priority', 'id'] },
  references: { idPattern: '[A-Z]+-[0-9]+' },
  types: {},
  sprints: [],
};

const TEST_MODEL: VaultModel = {
  cards: {
    'F-001': {
      id: 'F-001',
      type: 'story',
      title: 'First Feature',
      status: 'Done',
      path: 'board/F-001-story.md',
    },
  },
  files: ['board/F-001-story.md', 'docs/intro.md'],
};

describe('MarkdownReader', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownReader],
    }).compileComponents();
  });

  it('renders a bare resolved ID as a clickable anchor with data-path', async () => {
    const fixture = TestBed.createComponent(MarkdownReader);

    fixture.componentRef.setInput('body', 'Refer to F-001 for details.');
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const anchor = host.querySelector('a[data-path]');
    expect(anchor).toBeTruthy();
    expect(anchor?.getAttribute('data-path')).toBe('board/F-001-story.md');
    expect(anchor?.textContent).toBe('F-001');
  });

  it('renders a bare unresolved ID as a span with reference-inert class', async () => {
    const fixture = TestBed.createComponent(MarkdownReader);

    fixture.componentRef.setInput('body', 'Refer to F-999 for details.');
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const span = host.querySelector('span.reference-inert');
    expect(span).toBeTruthy();
    expect(span?.textContent).toBe('F-999');
    expect(host.querySelector('a')).toBeNull();
  });

  it('emits navigate when clicking a resolved ID', async () => {
    const fixture = TestBed.createComponent(MarkdownReader);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('body', 'See F-001.');
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);

    let emittedPath: string | null = null;
    component.navigate.subscribe((path) => {
      emittedPath = path;
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const anchor = host.querySelector('a[data-path]') as HTMLElement;
    expect(anchor).toBeTruthy();

    anchor.click();
    fixture.detectChanges();

    expect(emittedPath).toBe('board/F-001-story.md');
  });

  it('skips decoration on text already inside an anchor', async () => {
    const fixture = TestBed.createComponent(MarkdownReader);

    fixture.componentRef.setInput('body', '[Link containing F-001](http://example.com)');
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const anchors = Array.from(host.querySelectorAll('a'));
    // There should be exactly the one markdown link rendering
    expect(anchors.length).toBe(1);
    expect(anchors[0].getAttribute('href')).toBe('http://example.com');
    expect(anchors[0].getAttribute('data-path')).toBeNull();
  });

  it('skips decoration on ID inside inline code', async () => {
    const fixture = TestBed.createComponent(MarkdownReader);

    fixture.componentRef.setInput('body', 'Use `F-001` as an example.');
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('a[data-path]')).toBeNull();
    expect(host.querySelector('span.reference-inert')).toBeNull();
    const code = host.querySelector('code');
    expect(code?.textContent).toBe('F-001');
  });

  it('skips decoration on ID inside a fenced code block', async () => {
    const fixture = TestBed.createComponent(MarkdownReader);

    fixture.componentRef.setInput('body', '```\nF-001\n```');
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('a[data-path]')).toBeNull();
    expect(host.querySelector('span.reference-inert')).toBeNull();
    const pre = host.querySelector('pre');
    expect(pre).toBeTruthy();
  });

  it('generated reference anchor has href and is keyboard-accessible', async () => {
    const fixture = TestBed.createComponent(MarkdownReader);

    fixture.componentRef.setInput('body', 'See F-001 for details.');
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const anchor = host.querySelector('a[data-path]') as HTMLAnchorElement | null;
    expect(anchor).toBeTruthy();
    expect(anchor?.getAttribute('href')).not.toBeNull();
  });
});
