import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { renderMarkdown } from './render-markdown';
import {
  resolveReferences,
  resolveRelativeLink,
  toPosixPath,
  type VaultConfig,
  type VaultModel,
} from '@mos/core';

/** Schemes that open in a new tab; anything else with a scheme renders inert (F-017). */
const EXTERNAL_SCHEMES = /^(?:https?|mailto):/i;

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

  constructor() {
    effect(() => {
      const containerEl = this.containerRef()?.nativeElement;
      if (!containerEl) return;

      const htmlVal = this.html();
      const bodyVal = this.body();
      const modelVal = this.model();
      const configVal = this.config();

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
        if (node.nodeType === 3) { // TEXT_NODE
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
    });
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
