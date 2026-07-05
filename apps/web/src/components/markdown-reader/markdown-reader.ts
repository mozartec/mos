import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { renderMarkdown } from './render-markdown';
import { ThemeService } from '../../services/theme-service';
import {
  findFoldedMatches,
  resolveReferences,
  resolveRelativeLink,
  toPosixPath,
  type VaultConfig,
  type VaultModel,
} from '@mos/core';

/** Schemes that open in a new tab; anything else with a scheme renders inert (F-017). */
const EXTERNAL_SCHEMES = /^(?:https?|mailto):/i;

/**
 * Elements whose text is never decorated by the reader's DOM passes — links and
 * verbatim spans. Shared by the id-reference pass and the search-highlight pass
 * (F-036-S-03) so neither wraps a match inside a link or code: turning `F-001`
 * in a code fence into a live link, or marking a term inside a URL, is wrong.
 */
const SKIP_TAGS = new Set(['a', 'code', 'pre', 'kbd', 'samp']);

/**
 * The text nodes under `root` that are safe to decorate: every text node with no
 * {@link SKIP_TAGS} ancestor up to `root`. Both the id-reference pass and the
 * highlight pass walk the DOM through this, so they honor one skip rule; the
 * highlight pass passes `extraSkip` for its additional exclusions.
 */
function collectDecoratableTextNodes(
  root: HTMLElement,
  extraSkip?: (el: Element) => boolean,
): Text[] {
  const nodes: Text[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      // TEXT_NODE — skip it if any ancestor below `root` is a verbatim element or
      // (for the highlight pass) matches the caller's extra predicate.
      let parent: Node | null = node.parentNode;
      while (parent && parent !== root) {
        if (SKIP_TAGS.has(parent.nodeName.toLowerCase())) return;
        if (extraSkip && parent instanceof Element && extraSkip(parent)) return;
        parent = parent.parentNode;
      }
      nodes.push(node as Text);
    } else {
      for (const child of Array.from(node.childNodes)) walk(child);
    }
  };
  walk(root);
  return nodes;
}

/**
 * Replace one text node with an interleaved run of text and wrapper elements —
 * the shared "split a Text node into decorated segments" surgery of both the
 * id-reference pass and the search-highlight pass (F-036-S-03 review), so a fix
 * to one reaches the other rather than drifting.
 */
function replaceTextNodeWithSegments(node: Text, segments: readonly Node[]): void {
  const parent = node.parentNode;
  if (!parent) return;
  for (const segment of segments) parent.insertBefore(segment, node);
  parent.removeChild(node);
}

/**
 * Extra skip rule for the search-highlight pass, beyond {@link SKIP_TAGS}: never
 * mark inside a rendered mermaid diagram's SVG, nor inside a dimmed
 * `.reference-inert` span — its `opacity` would composite the `<mark>` below the
 * AA contrast its colours are proven at (F-036-S-03 review).
 */
function isHighlightSkipped(el: Element): boolean {
  return el.nodeName.toLowerCase() === 'svg' || el.classList.contains('reference-inert');
}

/**
 * Mermaid mutates module-global config/state on every `initialize`/`render`, so
 * concurrent renders — a theme flip while a diagram is still rendering, or two
 * live readers — corrupt each other (a valid diagram can then throw and show the
 * error note). All renders across every MarkdownReader are therefore serialized
 * through one chain, and a module-global counter keeps render ids unique across
 * instances.
 */
let mermaidRenderChain: Promise<void> = Promise.resolve();
let mermaidRenderSeq = 0;

/** First-token diagram type → a human name for a diagram's accessible label. */
const MERMAID_TYPE_LABELS: Record<string, string> = {
  flowchart: 'Flowchart',
  graph: 'Flowchart',
  sequencediagram: 'Sequence diagram',
  classdiagram: 'Class diagram',
  statediagram: 'State diagram',
  'statediagram-v2': 'State diagram',
  erdiagram: 'Entity-relationship diagram',
  gantt: 'Gantt chart',
  pie: 'Pie chart',
  journey: 'User journey',
  gitgraph: 'Git graph',
  mindmap: 'Mind map',
  timeline: 'Timeline',
  quadrantchart: 'Quadrant chart',
  block: 'Block diagram',
  'block-beta': 'Block diagram',
};

/**
 * A meaningful accessible name for a rendered diagram: the author's title
 * (`accTitle`, else a frontmatter `title:`) if present, else the diagram type —
 * so a screen-reader user can tell a flowchart from a sequence diagram instead
 * of hearing "Diagram" for every one. Leading `--- … ---` frontmatter and
 * `%%{ … }%%` init directives are peeled first so they aren't misread as the
 * type — exactly the configured diagrams that would otherwise regress.
 */
function mermaidLabel(source: string): string {
  let rest = source.trim();
  let frontmatterTitle: string | undefined;
  for (;;) {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(rest);
    if (frontmatter) {
      frontmatterTitle ??= /^\s*title\s*:\s*(.+)$/im.exec(frontmatter[1])?.[1]?.trim();
      rest = rest.slice(frontmatter[0].length).trimStart();
      continue;
    }
    const directive = /^%%\{[\s\S]*?\}%%[ \t]*\r?\n?/.exec(rest);
    if (directive) {
      rest = rest.slice(directive[0].length).trimStart();
      continue;
    }
    break;
  }

  const accTitle = /^\s*accTitle\s*:\s*(.+)$/im.exec(source)?.[1]?.trim();
  if (accTitle) return accTitle;
  if (frontmatterTitle) return frontmatterTitle;

  const firstToken = rest.split(/[\s\n{(]/)[0]?.toLowerCase() ?? '';
  return MERMAID_TYPE_LABELS[firstToken] ?? 'Diagram';
}

@Component({
  selector: 'app-markdown-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './markdown-reader.html',
})
export class MarkdownReader {
  readonly body = input.required<string>();
  readonly model = input.required<VaultModel>();
  readonly config = input.required<VaultConfig>();

  /**
   * Vault-relative path of the file being rendered; relative links resolve
   * against its folder (F-017). Defaults to '' (the vault root) so existing
   * hosts that only render id references keep working unchanged.
   */
  readonly path = input<string>('');

  /**
   * Term(s) to light up in the rendered body — a neutral "mark this text"
   * capability, not "search" (the wiki feeds it `?q=`, F-036-S-03). Empty (the
   * default) decorates nothing, so hosts that don't highlight — the card page,
   * the reader lens — are unaffected.
   */
  readonly highlightTerms = input<string>('');

  /**
   * Whether to scroll the first highlighted match into view when the highlighted
   * content changes. The decision belongs to the host that knows *why* the
   * document opened: the wiki sets it (a result was opened) while other hosts
   * leave it off, so a future "find on page" needn't inherit scroll-on-open
   * (F-036-S-03 review).
   */
  readonly scrollToFirstMatch = input<boolean>(false);

  readonly navigate = output<string>();

  readonly containerRef = viewChild<ElementRef<HTMLElement>>('container');

  protected readonly html = computed(() => renderMarkdown(this.body()));

  private readonly themeService = inject(ThemeService);

  /** Monotonic guard so a superseded async diagram render never mutates the DOM. */
  private mermaidGen = 0;

  /**
   * The inputs the base DOM was last rendered from. The expensive render
   * (innerHTML + id/anchor decoration + mermaid) is skipped when only the
   * highlight terms changed, so a per-keystroke `?q=` edit doesn't tear the DOM
   * down and re-schedule mermaid every character (F-036-S-03 review). `null`
   * before the first render forces it.
   */
  private prevHtml: string | null = null;
  private prevIsDark: boolean | null = null;
  private prevModel: VaultModel | null = null;
  private prevConfig: VaultConfig | null = null;

  /**
   * The rendered `(body, terms)` the highlight pass last processed. Scrolling
   * fires only when this pair changes (a new document or a new query) — never on
   * a same-content re-render like a theme flip — and it is keyed on the rendered
   * *body*, not the path, so a transient render during an async open (path
   * already switched, body not yet) can't consume the scroll for the wrong
   * document (F-036-S-03 review).
   */
  private lastScrollBody: string | null = null;
  private lastScrollTerms = '';

  constructor() {
    effect(() => {
      const containerEl = this.containerRef()?.nativeElement;
      // Read every dependency unconditionally so the tracked set is stable across
      // runs regardless of which branch below executes.
      const htmlVal = this.html();
      const bodyVal = this.body();
      const modelVal = this.model();
      const configVal = this.config();
      const pathVal = this.path();
      const isDark = this.themeService.isDark();
      const terms = this.highlightTerms();
      const scroll = this.scrollToFirstMatch();
      if (!containerEl) return;

      // The base render (innerHTML + id/anchor decoration + mermaid) depends on
      // the html, theme, model and config — never on the highlight terms. So when
      // only the query changed (a per-keystroke `?q=` edit), skip it entirely and
      // just re-mark, instead of rebuilding the DOM and re-scheduling mermaid on
      // every character (F-036-S-03 review).
      const baseChanged =
        htmlVal !== this.prevHtml ||
        isDark !== this.prevIsDark ||
        modelVal !== this.prevModel ||
        configVal !== this.prevConfig;

      if (baseChanged) {
        this.prevHtml = htmlVal;
        this.prevIsDark = isDark;
        this.prevModel = modelVal;
        this.prevConfig = configVal;
        this.renderBase(containerEl, htmlVal, bodyVal, modelVal, configVal, pathVal, isDark);
      } else {
        // Base DOM is intact from the last render; drop the previous query's marks
        // before laying the new ones down.
        this.clearHighlights(containerEl);
      }

      this.applyHighlights(containerEl, bodyVal, terms, scroll);
    });
  }

  /**
   * Render the document body into `containerEl`: sanitized markdown HTML, then the
   * id-reference decoration pass (bare ids → in-app links or dimmed spans,
   * F-003), anchor classification (F-017), and mermaid diagrams (F-035-S-03). The
   * expensive part of the reader — run only when the body/theme/model/config
   * changed, not on a highlight-terms-only update.
   */
  private renderBase(
    containerEl: HTMLElement,
    htmlVal: string,
    bodyVal: string,
    modelVal: VaultModel,
    configVal: VaultConfig,
    pathVal: string,
    isDark: boolean,
  ): void {
    // renderMarkdown runs DOMPurify before producing this HTML, so bypassing
    // Angular's [innerHTML] sanitizer here does not regress XSS safety.
    containerEl.innerHTML = htmlVal;

    // resolveReferences is used only for id→path resolution here; the DOM walk
    // below is the single source of truth for which text tokens get decorated.
    // The core's position/offset data is intentionally unused — the card spec
    // forbids source-offset indexing into HTML (F-003-S-03).
    const references = resolveReferences(bodyVal, modelVal, configVal);
    const resolvedMap = new Map<string, string>();
    for (const ref of references) {
      if (!ref.unresolved && ref.target) {
        resolvedMap.set(ref.id, ref.target.path);
      }
    }

    const idPatternStr = configVal.references.idPattern;
    let idRegex: RegExp;
    try {
      idRegex = new RegExp(idPatternStr, 'g');
    } catch (e) {
      console.error('Invalid idPattern regex:', e);
      return;
    }

    // Link/code-skipping walk shared with the highlight pass (SKIP_TAGS):
    // decorating an id inside a code fence into a live wiki link is wrong.
    for (const node of collectDecoratableTextNodes(containerEl)) {
      const text = node.textContent || '';
      idRegex.lastIndex = 0;

      let lastIndex = 0;
      const newNodes: Node[] = [];
      let match: RegExpExecArray | null;
      let hasMatches = false;

      while ((match = idRegex.exec(text)) !== null) {
        hasMatches = true;
        const matchedText = match[0];
        const matchIndex = match.index;

        if (matchedText.length === 0) {
          idRegex.lastIndex++;
          continue;
        }

        if (matchIndex > lastIndex) {
          newNodes.push(document.createTextNode(text.substring(lastIndex, matchIndex)));
        }

        const targetPath = resolvedMap.get(matchedText);
        if (targetPath !== undefined) {
          const a = document.createElement('a');
          a.setAttribute('href', '#');
          a.setAttribute('data-path', targetPath);
          a.textContent = matchedText;
          newNodes.push(a);
        } else {
          // Render unresolved IDs as dimmed non-links. Per card F-003-S-03,
          // unresolved ids must be "visibly dim" so the reader can tell a bare
          // id-shaped token has no target. Tokens like UTF-8 or COVID-19 may be
          // false-positives but the tradeoff is accepted for MVP.
          const span = document.createElement('span');
          span.className = 'reference-inert';
          span.textContent = matchedText;
          newNodes.push(span);
        }

        lastIndex = idRegex.lastIndex;
      }

      if (lastIndex < text.length) {
        newNodes.push(document.createTextNode(text.substring(lastIndex)));
      }

      if (hasMatches && newNodes.length > 0) {
        replaceTextNodeWithSegments(node, newNodes);
      }
    }

    this.classifyAnchors(containerEl, modelVal, pathVal);
    this.renderMermaid(containerEl, isDark);
  }

  /**
   * Remove the previous query's `<mark class="search-highlight">`s, merging the
   * text back together so the next pass re-matches contiguous text. Called before
   * a re-mark when only the terms changed and the base DOM is untouched.
   */
  private clearHighlights(containerEl: HTMLElement): void {
    const marks = containerEl.querySelectorAll('mark.search-highlight');
    if (marks.length === 0) return;
    for (const mark of Array.from(marks)) {
      mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
    }
    containerEl.normalize();
  }

  /**
   * Light up every match of `terms` in the rendered body, wrapping each in a
   * `<mark class="search-highlight">`, and — when `scroll` is set and the
   * highlighted content changed — scroll the first into view (F-036-S-03). A
   * term/DOM pass: it re-scans the rendered text nodes with the one shared core
   * fold rule ({@link findFoldedMatches}), so it agrees with the index and snippet
   * on the fold and never indexes a source offset into rendered HTML
   * (F-003-S-03). Links, code, diagram SVG and dimmed reference spans are skipped
   * ({@link SKIP_TAGS} + {@link isHighlightSkipped}).
   */
  private applyHighlights(
    containerEl: HTMLElement,
    body: string,
    terms: string,
    scroll: boolean,
  ): void {
    const trimmed = terms.trim();
    if (trimmed === '') {
      // Nothing marked; forget the last target so re-entering the same query
      // scrolls to it afresh rather than being suppressed as a repeat.
      this.lastScrollBody = null;
      this.lastScrollTerms = '';
      return;
    }

    let firstMark: HTMLElement | null = null;
    for (const node of collectDecoratableTextNodes(containerEl, isHighlightSkipped)) {
      const text = node.textContent ?? '';
      const matches = findFoldedMatches(text, trimmed);
      if (matches.length === 0) continue;

      // Rebuild the text node as alternating plain-text and <mark> segments.
      const pieces: Node[] = [];
      let cursor = 0;
      for (const { start, end } of matches) {
        if (start > cursor) pieces.push(document.createTextNode(text.slice(cursor, start)));
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = text.slice(start, end);
        firstMark ??= mark;
        pieces.push(mark);
        cursor = end;
      }
      if (cursor < text.length) pieces.push(document.createTextNode(text.slice(cursor)));
      replaceTextNodeWithSegments(node, pieces);
    }

    // Scroll only when the host opted in, a match exists, and the rendered
    // (body, terms) changed since the last pass — so a theme flip (same content)
    // never yanks, a stale-body transient render during an async open is a no-op,
    // and re-entering a query after a blank one scrolls afresh (F-036-S-03 review).
    const changed = body !== this.lastScrollBody || trimmed !== this.lastScrollTerms;
    this.lastScrollBody = body;
    this.lastScrollTerms = trimmed;
    if (scroll && changed && firstMark) firstMark.scrollIntoView?.({ block: 'center' });
  }

  /**
   * Schedule rendering of fenced ` ```mermaid ` blocks
   * (`<pre><code class="language-mermaid">`) as inline SVG. Mermaid is heavy, so
   * it is **dynamically imported — and only when a page actually contains a
   * diagram** — keeping it out of the board/wiki initial bundle. Because mermaid
   * holds module-global state, the actual render is queued on a shared chain and
   * never run concurrently; the per-instance `mermaidGen` guard drops any run a
   * newer content/theme change superseded.
   */
  private renderMermaid(container: HTMLElement, isDark: boolean): void {
    // Lazy gate: never touch mermaid for a plain doc (no import, no queue).
    if (container.querySelector('code.language-mermaid') === null) return;
    const generation = ++this.mermaidGen;
    mermaidRenderChain = mermaidRenderChain
      .then(() => this.renderMermaidDiagrams(container, generation, isDark))
      .catch(() => {
        // A single render failure must not break the shared chain.
      });
  }

  /**
   * Render every mermaid block in `container` to SVG, in serialized isolation.
   * Rendered with `securityLevel: 'strict'` — vault markdown is untrusted, so
   * mermaid runs its output through its own (version-pinned) DOMPurify and
   * disables html labels / scripts / click handlers. A diagram that fails to
   * parse keeps its source visible with an error note and never throws.
   */
  private async renderMermaidDiagrams(
    container: HTMLElement,
    generation: number,
    isDark: boolean,
  ): Promise<void> {
    if (generation !== this.mermaidGen) return; // superseded before our turn on the queue
    // Re-query now: a newer effect run may have reset innerHTML while we waited.
    const blocks = Array.from(container.querySelectorAll<HTMLElement>('code.language-mermaid'));
    if (blocks.length === 0) return;

    let mermaidModule: typeof import('mermaid');
    try {
      mermaidModule = await import('mermaid');
    } catch {
      return; // engine failed to load — leave the source code visible
    }
    if (generation !== this.mermaidGen) return;
    const mermaid = mermaidModule.default;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDark ? 'dark' : 'default',
    });

    for (const code of blocks) {
      const host = code.closest('pre') ?? code;
      const source = code.textContent ?? '';
      try {
        // Module-global id so two reader instances can't collide on it.
        const { svg } = await mermaid.render(`mermaid-${mermaidRenderSeq++}`, source);
        if (generation !== this.mermaidGen) return; // superseded mid-flight
        const figure = document.createElement('figure');
        figure.className = 'mermaid';
        figure.setAttribute('role', 'img');
        figure.setAttribute('aria-label', mermaidLabel(source));
        figure.innerHTML = svg;
        // The <figure> carries the accessible name; hide the raw SVG internals
        // from assistive tech so it isn't announced as a wall of nodes.
        figure.querySelector('svg')?.setAttribute('aria-hidden', 'true');
        host.replaceWith(figure);
      } catch {
        if (generation !== this.mermaidGen) return;
        const note = document.createElement('p');
        note.className = 'mermaid-error';
        note.textContent = 'This diagram could not be rendered.';
        host.insertAdjacentElement('afterend', note);
      }
    }
  }

  /**
   * Classify every markdown-authored anchor (F-017): external links open in a
   * new tab, relative links that resolve to a vault file become in-app
   * navigations, and everything else — missing targets, root escapes,
   * unsupported schemes, in-page anchors — degrades to the same inert dimmed
   * treatment as unresolved id references, never a 404. Runs after the id
   * pass, which tags its own anchors with `data-path` (skipped here).
   */
  private classifyAnchors(containerEl: HTMLElement, model: VaultModel, currentPath: string): void {
    // The vault's file listing: wiki-scope files plus card files. Membership
    // is checked case-exactly — resolution never guesses at folder names
    // (ADR-003); a target outside the listing is simply not navigable.
    const knownFiles = new Set<string>(model.files.map(toPosixPath));
    for (const card of Object.values(model.cards)) {
      knownFiles.add(toPosixPath(card.path));
    }

    for (const anchor of Array.from(containerEl.querySelectorAll('a[href]'))) {
      if (anchor.hasAttribute('data-path')) continue;

      const href = anchor.getAttribute('href') ?? '';
      if (EXTERNAL_SCHEMES.test(href)) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
        continue;
      }

      const resolved = resolveRelativeLink(currentPath, href);
      if (resolved !== null && knownFiles.has(resolved)) {
        anchor.setAttribute('href', '#');
        anchor.setAttribute('data-path', resolved);
        continue;
      }

      const span = document.createElement('span');
      span.className = 'reference-inert';
      while (anchor.firstChild) span.appendChild(anchor.firstChild);
      anchor.replaceWith(span);
    }
  }

  protected onContainerClick(event: MouseEvent): void {
    this.activateAnchor(event.target as HTMLElement | null, event);
  }

  protected onContainerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      this.activateAnchor(event.target as HTMLElement | null, event);
    }
  }

  private activateAnchor(target: HTMLElement | null, event: Event): void {
    if (!target) return;

    const anchor = target.closest('a[data-path]');
    if (anchor) {
      event.preventDefault();
      const path = anchor.getAttribute('data-path');
      if (path) {
        this.navigate.emit(path);
      }
    }
  }
}
