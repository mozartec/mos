import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const markdown = new Marked({
  async: false,
  gfm: true,
});

/**
 * Render markdown into sanitized HTML. Vault content is untrusted.
 */
export function renderMarkdown(body: string): string {
  const unsafeHtml = markdown.parse(body, { async: false });
  return DOMPurify.sanitize(unsafeHtml, { USE_PROFILES: { html: true } });
}
