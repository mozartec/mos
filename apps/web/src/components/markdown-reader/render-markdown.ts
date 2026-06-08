import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const markdown = new Marked({
  gfm: true,
});

/**
 * Render markdown into sanitized HTML. Vault content is untrusted.
 */
export function renderMarkdown(body: string): string {
  const rendered = markdown.parse(body);
  const unsafeHtml = typeof rendered === 'string' ? rendered : '';
  return DOMPurify.sanitize(unsafeHtml, { USE_PROFILES: { html: true } });
}
