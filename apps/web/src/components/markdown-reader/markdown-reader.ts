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
import { resolveReferences, type VaultConfig, type VaultModel } from '@mos/core';

@Component({
  selector: 'app-markdown-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './markdown-reader.html',
})
export class MarkdownReader {
  readonly body = input.required<string>();
  readonly model = input.required<VaultModel>();
  readonly config = input.required<VaultConfig>();

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

      // Render innerHTML manually to prevent Angular from overwriting manual DOM changes.
      containerEl.innerHTML = htmlVal;

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

      const textNodes: Text[] = [];
      const walk = (node: Node) => {
        if (node.nodeType === 3) { // TEXT_NODE
          let parent: Node | null = node.parentNode;
          let insideAnchor = false;
          while (parent && parent !== containerEl) {
            if (parent.nodeName.toLowerCase() === 'a') {
              insideAnchor = true;
              break;
            }
            parent = parent.parentNode;
          }
          if (!insideAnchor) {
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
            a.setAttribute('data-path', targetPath);
            a.textContent = matchedText;
            newNodes.push(a);
          } else {
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
    });
  }

  protected onContainerClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
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
