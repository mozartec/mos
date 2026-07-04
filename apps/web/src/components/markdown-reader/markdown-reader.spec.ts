import { TestBed } from '@angular/core/testing';
import { MarkdownReader } from './markdown-reader';
import { type VaultConfig, type VaultModel } from '@mos/core';

// Mermaid is dynamically imported by the reader; mock it so the async diagram
// pass is deterministic in jsdom (real mermaid needs layout APIs jsdom lacks).
const { mermaidRender, mermaidInitialize } = vi.hoisted(() => ({
  mermaidRender: vi.fn(),
  mermaidInitialize: vi.fn(),
}));
vi.mock('mermaid', () => ({
  default: { initialize: mermaidInitialize, render: mermaidRender },
}));

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
  areas: {},
  fieldOrder: [],
};

const TEST_MODEL: VaultModel = {
  cards: {
    'F-001': {
      id: 'F-001',
      type: 'story',
      title: 'First Feature',
      status: 'Done',
      path: 'board/F-001-story.md',
      fields: {},
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

  it('emits navigate when activating a resolved ID via keyboard (Enter / Space)', async () => {
    for (const key of ['Enter', ' ']) {
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
      const anchor = host.querySelector('a[data-path]') as HTMLAnchorElement;
      expect(anchor).toBeTruthy();

      anchor.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();

      expect(emittedPath).toBe('board/F-001-story.md');
    }
  });

  // ── F-017: relative markdown links navigate in-app ─────────────────────────

  async function renderBody(body: string, path = ''): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(MarkdownReader);
    fixture.componentRef.setInput('body', body);
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);
    fixture.componentRef.setInput('path', path);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('turns a same-folder relative link into an in-app navigation', async () => {
    const host = await renderBody('[the intro](intro.md)', 'docs/00-README.md');

    const anchor = host.querySelector('a[data-path]');
    expect(anchor).toBeTruthy();
    expect(anchor?.getAttribute('data-path')).toBe('docs/intro.md');
    expect(anchor?.getAttribute('href')).toBe('#');
    expect(anchor?.textContent).toBe('the intro');
  });

  it('resolves a cross-folder ../ link against the current file', async () => {
    const host = await renderBody('[intro](../docs/intro.md)', 'board/F-001-story.md');

    expect(host.querySelector('a[data-path]')?.getAttribute('data-path')).toBe('docs/intro.md');
  });

  it('emits navigate when clicking a relative path link', async () => {
    const fixture = TestBed.createComponent(MarkdownReader);
    fixture.componentRef.setInput('body', '[the intro](intro.md)');
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);
    fixture.componentRef.setInput('path', 'docs/00-README.md');

    let emittedPath: string | null = null;
    fixture.componentInstance.navigate.subscribe((path) => {
      emittedPath = path;
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('a[data-path]') as HTMLElement).click();
    fixture.detectChanges();

    expect(emittedPath).toBe('docs/intro.md');
  });

  it('renders a link to a missing file as an inert dimmed span', async () => {
    const host = await renderBody('[gone](missing.md)', 'docs/00-README.md');

    const span = host.querySelector('span.reference-inert');
    expect(span).toBeTruthy();
    expect(span?.textContent).toBe('gone');
    expect(host.querySelector('a')).toBeNull();
  });

  it('renders a link escaping the vault root as inert', async () => {
    const host = await renderBody('[escape](../../etc/passwd)', 'docs/00-README.md');

    expect(host.querySelector('span.reference-inert')).toBeTruthy();
    expect(host.querySelector('a')).toBeNull();
  });

  it('opens external links in a new tab with rel="noopener noreferrer"', async () => {
    const host = await renderBody('[site](https://example.com)', 'docs/00-README.md');

    const anchor = host.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('https://example.com');
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor?.getAttribute('data-path')).toBeNull();
  });

  it('strips fragments and decodes %20 when resolving a relative link', async () => {
    const host = await renderBody('[spec](intro.md#section)', 'docs/00-README.md');

    expect(host.querySelector('a[data-path]')?.getAttribute('data-path')).toBe('docs/intro.md');
  });

  // ── F-035-S-03: mermaid diagrams ───────────────────────────────────────────

  async function renderAndSettle(body: string): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(MarkdownReader);
    fixture.componentRef.setInput('body', body);
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);
    fixture.detectChanges();
    await fixture.whenStable();
    // Flush the dynamic import() + async mermaid.render() chain.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('leaves a non-mermaid fenced code block untouched and never loads mermaid', async () => {
    mermaidRender.mockReset();
    const host = await renderAndSettle('```ts\nconst x = 1;\n```');

    expect(host.querySelector('figure.mermaid')).toBeNull();
    expect(host.querySelector('pre code')).toBeTruthy();
    expect(mermaidRender).not.toHaveBeenCalled();
  });

  it('renders a mermaid fenced block as an inline SVG figure with an accessible name', async () => {
    mermaidRender.mockReset();
    mermaidRender.mockResolvedValue({ svg: '<svg data-testid="diagram"><g></g></svg>' });

    const host = await renderAndSettle('```mermaid\nflowchart TD\n  A --> B\n```');

    const figure = host.querySelector('figure.mermaid');
    expect(figure).toBeTruthy();
    expect(figure?.getAttribute('role')).toBe('img');
    expect(figure?.getAttribute('aria-label')).toBe('Diagram');
    expect(figure?.querySelector('svg[data-testid="diagram"]')).toBeTruthy();
    expect(figure?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    // The source code block is replaced by the diagram, and the source was rendered.
    expect(host.querySelector('code.language-mermaid')).toBeNull();
    expect(mermaidRender).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('flowchart TD'),
    );
  });

  it('falls back to the source with an error note when a diagram fails to parse', async () => {
    mermaidRender.mockReset();
    mermaidRender.mockRejectedValue(new Error('parse error'));

    const host = await renderAndSettle('```mermaid\nnot a diagram\n```');

    expect(host.querySelector('figure.mermaid')).toBeNull();
    // Source stays visible, with an error note beside it.
    expect(host.querySelector('code.language-mermaid')?.textContent).toContain('not a diagram');
    expect(host.querySelector('.mermaid-error')).toBeTruthy();
  });
});
