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
  resolveReferences,
  resolveRelativeLink,
  toPosixPath,
  type VaultConfig,
  type VaultModel,
} from '@mos/core';

/** Schemes that open in a new tab; anything else with a scheme renders inert (F-017). */
const EXTERNAL_SCHEMES = /^(?:https?|mailto):/i;

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

  readonly navigate = output<string>();

  readonly containerRef = viewChild<ElementRef<HTMLElement>>('container');

  protected readonly html = computed(() => renderMarkdown(this.body()));

  private readonly themeService = inject(ThemeService);

  /** Monotonic guard so a superseded async diagram render never mutates the DOM. */
  private mermaidGen = 0;

  constructor() {
    effect(() => {
      const containerEl = this.containerRef()?.nativeElement;
      if (!containerEl) return;

      const htmlVal = this.html();
      const bodyVal = this.body();
      const modelVal = this.model();
      const configVal = this.config();
      // Read as a dependency: a theme flip re-runs the effect, which re-sets
      // innerHTML (restoring the mermaid source blocks) so diagrams re-render
      // in the new theme.
      const isDark = this.themeService.isDark();

      // renderMarkdown runs DOMPurify before producing this HTML, so bypassing
      // Angular's [innerHTML] sanitizer here does not regress XSS safety.
      containerEl.innerHTML = htmlVal;

      // resolveReferences is used only for id→path resolution here; the DOM
      // walk below is the single source of truth for which text tokens get
      // decorated. The core's position/offset data is intentionally unused —
      // the card spec forbids source-offset indexing into HTML (F-003-S-03).
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

      // Elements whose text should never be decorated (links, code, and other
      // verbatim elements). Decorating code examples would turn `F-001` in a
      // code fence into a live wiki link, which is incorrect.
      const SKIP_TAGS = new Set(['a', 'code', 'pre', 'kbd', 'samp']);

      const textNodes: Text[] = [];
      const walk = (node: Node) => {
        if (node.nodeType === 3) {
          // TEXT_NODE
          let parent: Node | null = node.parentNode;
          let insideSkipped = false;
          while (parent && parent !== containerEl) {
            if (SKIP_TAGS.has(parent.nodeName.toLowerCase())) {
              insideSkipped = true;
              break;
            }
            parent = parent.parentNode;
          }
          if (!insideSkipped) {
            textNodes.push(node as Text);
          }
        } else {
          for (const child of Array.from(node.childNodes)) {
            walk(child);
          }
        }
      };

      walk(containerEl);

      for (const node of textNodes) {
        const text = node.textContent || '';
        idRegex.lastIndex = 0;

        const parent = node.parentNode;
        if (!parent) continue;

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

          const id = matchedText;
          const targetPath = resolvedMap.get(id);

          if (targetPath !== undefined) {
            const a = document.createElement('a');
            a.setAttribute('href', '#');
            a.setAttribute('data-path', targetPath);
            a.textContent = matchedText;
            newNodes.push(a);
          } else {
            // Render unresolved IDs as dimmed non-links. Per card F-003-S-03,
            // unresolved ids must be "visibly dim" so the reader can tell a
            // bare id-shaped token has no target. Tokens like UTF-8 or COVID-19
            // may be false-positives but the tradeoff is accepted for MVP.
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
          for (const newNode of newNodes) {
            parent.insertBefore(newNode, node);
          }
          parent.removeChild(node);
        }
      }

      this.classifyAnchors(containerEl, modelVal);
      this.renderMermaid(containerEl, isDark);
    });
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
  private classifyAnchors(containerEl: HTMLElement, model: VaultModel): void {
    // The vault's file listing: wiki-scope files plus card files. Membership
    // is checked case-exactly — resolution never guesses at folder names
    // (ADR-003); a target outside the listing is simply not navigable.
    const knownFiles = new Set<string>(model.files.map(toPosixPath));
    for (const card of Object.values(model.cards)) {
      knownFiles.add(toPosixPath(card.path));
    }

    const currentPath = this.path();
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
