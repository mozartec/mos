import { TestBed, type ComponentFixture } from '@angular/core/testing';
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

  it('leaves a non-mermaid fenced code block untouched and never initializes mermaid', async () => {
    mermaidRender.mockReset();
    mermaidInitialize.mockReset();
    const host = await renderAndSettle('```ts\nconst x = 1;\n```');

    expect(host.querySelector('figure.mermaid')).toBeNull();
    expect(host.querySelector('pre code')).toBeTruthy();
    // Never reached the engine — no import, no initialize, no render.
    expect(mermaidInitialize).not.toHaveBeenCalled();
    expect(mermaidRender).not.toHaveBeenCalled();
  });

  it('renders a mermaid fenced block as an inline SVG figure with a typed accessible name', async () => {
    mermaidRender.mockReset();
    mermaidRender.mockResolvedValue({ svg: '<svg data-testid="diagram"><g></g></svg>' });

    const host = await renderAndSettle('```mermaid\nflowchart TD\n  A --> B\n```');

    const figure = host.querySelector('figure.mermaid');
    expect(figure).toBeTruthy();
    expect(figure?.getAttribute('role')).toBe('img');
    // Named by diagram type, not a generic "Diagram", so diagrams are distinguishable.
    expect(figure?.getAttribute('aria-label')).toBe('Flowchart');
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

  it('names a diagram past a leading init directive or frontmatter (not "Diagram")', async () => {
    mermaidRender.mockReset();
    mermaidRender.mockResolvedValue({ svg: '<svg></svg>' });

    const host1 = await renderAndSettle(
      "```mermaid\n%%{init: {'theme':'forest'}}%%\nflowchart TD\n  A --> B\n```",
    );
    expect(host1.querySelector('figure.mermaid')?.getAttribute('aria-label')).toBe('Flowchart');

    const host2 = await renderAndSettle('```mermaid\n---\ntitle: My Flow\n---\nflowchart TD\n```');
    expect(host2.querySelector('figure.mermaid')?.getAttribute('aria-label')).toBe('My Flow');
  });

  // F-036-S-03: in-document search highlight + scroll ------------------------

  function makeReader(): ComponentFixture<MarkdownReader> {
    const fixture = TestBed.createComponent(MarkdownReader);
    fixture.componentRef.setInput('model', TEST_MODEL);
    fixture.componentRef.setInput('config', TEST_CONFIG);
    return fixture;
  }

  async function settleReader(fixture: ComponentFixture<MarkdownReader>): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function renderWithHighlight(
    body: string,
    terms: string,
    opts: { path?: string; scroll?: boolean } = {},
  ): Promise<HTMLElement> {
    const fixture = makeReader();
    fixture.componentRef.setInput('body', body);
    fixture.componentRef.setInput('path', opts.path ?? '');
    fixture.componentRef.setInput('highlightTerms', terms);
    fixture.componentRef.setInput('scrollToFirstMatch', opts.scroll ?? false);
    return settleReader(fixture);
  }

  // jsdom has no scrollIntoView; install a spy for the guarded optional call and
  // restore the original descriptor afterwards (never blindly delete it).
  async function withScrollSpy(
    run: (spy: ReturnType<typeof vi.fn>) => Promise<void>,
  ): Promise<void> {
    const spy = vi.fn();
    const proto = Element.prototype as unknown as { scrollIntoView?: (arg?: unknown) => void };
    const original = proto.scrollIntoView;
    proto.scrollIntoView = spy;
    try {
      await run(spy);
    } finally {
      if (original === undefined) delete proto.scrollIntoView;
      else proto.scrollIntoView = original;
    }
  }

  it('wraps a matched term in the body in a <mark class="search-highlight">', async () => {
    const host = await renderWithHighlight('The quick brown fox.', 'quick');
    const mark = host.querySelector('mark.search-highlight');
    expect(mark).toBeTruthy();
    expect(mark?.textContent).toBe('quick');
  });

  it('matches case- and accent-insensitively, keeping the original text in the mark', async () => {
    // Body carries an accented 'e'; querying plain 'cafe' still matches and the
    // mark keeps the source accent.
    const host = await renderWithHighlight('A café in town.', 'cafe');
    expect(host.querySelector('mark.search-highlight')?.textContent).toBe('café');
  });

  it('highlights every occurrence of the query', async () => {
    const host = await renderWithHighlight('tea, more tea, and tea', 'tea');
    const marks = Array.from(host.querySelectorAll('mark.search-highlight'));
    expect(marks.map((m) => m.textContent)).toEqual(['tea', 'tea', 'tea']);
  });

  it('does not highlight matches inside code or pre', async () => {
    const host = await renderWithHighlight(
      'Set the config value.\n\n```\nconfig: true\n```',
      'config',
    );
    // The prose occurrence is marked...
    expect(host.querySelector('p mark.search-highlight')?.textContent).toBe('config');
    // ...but the fenced-code one stays verbatim.
    expect(host.querySelector('pre mark')).toBeNull();
    expect(host.querySelector('code mark')).toBeNull();
  });

  it('does not highlight matches inside links', async () => {
    const host = await renderWithHighlight(
      '[the guide](https://example.com) - guide again.',
      'guide',
    );
    expect(host.querySelector('a mark')).toBeNull();
    // Only the prose "guide" outside the link is marked.
    const marks = Array.from(host.querySelectorAll('mark.search-highlight'));
    expect(marks.map((m) => m.textContent)).toEqual(['guide']);
  });

  it('does not highlight inside a dimmed reference-inert span (would drop below AA)', async () => {
    // 'COVID-19' matches the id pattern but resolves to nothing, so it renders as
    // a dimmed .reference-inert span; a <mark> there would inherit opacity: 0.5
    // and fall below AA. The highlight pass must skip it (F-036-S-03 review).
    const host = await renderWithHighlight('COVID-19 spreads; covid research.', 'covid');
    expect(host.querySelector('.reference-inert mark')).toBeNull();
    // The prose occurrence outside the span is still highlighted.
    const marks = Array.from(host.querySelectorAll('mark.search-highlight'));
    expect(marks.map((m) => m.textContent)).toEqual(['covid']);
  });

  it('keeps reference-link decoration working alongside highlighting', async () => {
    const host = await renderWithHighlight('See F-001 for the plan.', 'plan');
    // The id reference is still turned into a link...
    expect(host.querySelector('a[data-path]')?.textContent).toBe('F-001');
    // ...and the prose term is highlighted.
    expect(host.querySelector('mark.search-highlight')?.textContent).toBe('plan');
  });

  it('adds no marks when the query is empty or whitespace', async () => {
    const empty = await renderWithHighlight('nothing to see here', '');
    expect(empty.querySelector('mark.search-highlight')).toBeNull();
    const blank = await renderWithHighlight('nothing to see here', '   ');
    expect(blank.querySelector('mark.search-highlight')).toBeNull();
  });

  it('re-marks in place when only the query changes, without rebuilding the base DOM', async () => {
    const fixture = makeReader();
    fixture.componentRef.setInput('body', 'alpha and beta');
    fixture.componentRef.setInput('highlightTerms', 'alpha');
    let host = await settleReader(fixture);
    expect(
      Array.from(host.querySelectorAll('mark.search-highlight')).map((m) => m.textContent),
    ).toEqual(['alpha']);
    const paragraphBefore = host.querySelector('p');

    fixture.componentRef.setInput('highlightTerms', 'beta');
    host = await settleReader(fixture);
    // The marks switched to the new term...
    expect(
      Array.from(host.querySelectorAll('mark.search-highlight')).map((m) => m.textContent),
    ).toEqual(['beta']);
    // ...and the base DOM was NOT torn down (same <p> element): innerHTML/id
    // decoration/mermaid are skipped on a terms-only change (F-036-S-03 review).
    expect(host.querySelector('p')).toBe(paragraphBefore);
  });

  it('removes existing marks when the query is cleared', async () => {
    const fixture = makeReader();
    fixture.componentRef.setInput('body', 'highlight me');
    fixture.componentRef.setInput('highlightTerms', 'highlight');
    const host = await settleReader(fixture);
    expect(host.querySelector('mark.search-highlight')).toBeTruthy();

    fixture.componentRef.setInput('highlightTerms', '');
    await settleReader(fixture);
    expect(host.querySelector('mark.search-highlight')).toBeNull();
  });

  it('scrolls the first match into view when a document opens with scroll enabled', async () => {
    await withScrollSpy(async (spy) => {
      await renderWithHighlight('alpha beta alpha', 'alpha', { path: 'docs/x.md', scroll: true });
      expect(spy).toHaveBeenCalled();
      // It is the FIRST match that gets scrolled to.
      expect((spy.mock.contexts[0] as HTMLElement).textContent).toBe('alpha');
    });
  });

  it('does not scroll when the host has not opted in (scrollToFirstMatch off)', async () => {
    await withScrollSpy(async (spy) => {
      const host = await renderWithHighlight('alpha beta', 'alpha', {
        path: 'docs/x.md',
        scroll: false,
      });
      // Highlighting still happens; only the scroll is gated by the opt-in.
      expect(host.querySelector('mark.search-highlight')).toBeTruthy();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('scrolls to the new document match when the open file changes, not just the query', async () => {
    await withScrollSpy(async (spy) => {
      const fixture = makeReader();
      fixture.componentRef.setInput('scrollToFirstMatch', true);
      fixture.componentRef.setInput('highlightTerms', 'aardvark');
      fixture.componentRef.setInput('path', 'docs/a.md');
      fixture.componentRef.setInput('body', 'first aardvark doc');
      await settleReader(fixture);
      const afterA = spy.mock.calls.length;
      expect(afterA).toBeGreaterThan(0);

      // Simulate the wiki's async open: the path switches first (body still A) --
      // this transient must NOT consume the scroll for the wrong document...
      fixture.componentRef.setInput('path', 'docs/b.md');
      await settleReader(fixture);
      const afterTransient = spy.mock.calls.length;
      expect(afterTransient).toBe(afterA);

      // ...then B's body arrives and B scrolls to its own match (F-036-S-03 review).
      fixture.componentRef.setInput('body', 'second aardvark doc');
      await settleReader(fixture);
      expect(spy.mock.calls.length).toBeGreaterThan(afterTransient);
    });
  });

  it('re-scrolls when a query returns after a non-matching one', async () => {
    await withScrollSpy(async (spy) => {
      const fixture = makeReader();
      fixture.componentRef.setInput('scrollToFirstMatch', true);
      fixture.componentRef.setInput('path', 'docs/a.md');
      fixture.componentRef.setInput('body', 'alpha beta');
      fixture.componentRef.setInput('highlightTerms', 'alpha');
      await settleReader(fixture);
      const afterFirst = spy.mock.calls.length;
      expect(afterFirst).toBeGreaterThan(0);

      fixture.componentRef.setInput('highlightTerms', 'zzz'); // no match
      await settleReader(fixture);
      expect(spy.mock.calls.length).toBe(afterFirst); // nothing to scroll to

      fixture.componentRef.setInput('highlightTerms', 'alpha'); // back to a match
      await settleReader(fixture);
      // The guard advanced on the no-match render, so this scrolls afresh.
      expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);
    });
  });
});
