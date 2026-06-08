import { renderMarkdown } from './render-markdown';

describe('renderMarkdown', () => {
  it('renders GFM tables, fenced code, and task lists', () => {
    const input = [
      '| Name | Value |',
      '| --- | --- |',
      '| foo | bar |',
      '',
      '```ts',
      "console.log('hello');",
      '```',
      '',
      '- [x] done',
    ].join('\n');

    const html = renderMarkdown(input);

    expect(html).toContain('<table>');
    expect(html).toContain('<code class="language-ts">');
    expect(html).toContain('type="checkbox"');
  });

  it('sanitizes active HTML content', () => {
    const input = '<script>alert(1)</script><img src="x" onerror="alert(2)" />';
    const html = renderMarkdown(input);

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror=');
    expect(html).toContain('<img src="x">');
  });
});
