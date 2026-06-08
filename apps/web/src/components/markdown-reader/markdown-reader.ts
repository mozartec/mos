import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { renderMarkdown } from './render-markdown';

@Component({
  selector: 'app-markdown-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './markdown-reader.html',
})
export class MarkdownReader {
  readonly body = input.required<string>();

  protected readonly html = computed(() => renderMarkdown(this.body()));
}
