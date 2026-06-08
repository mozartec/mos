import { describe, expect, it } from 'vitest';
import { parseFile } from './parse-file.js';

describe('parseFile', () => {
  // ── valid frontmatter ──────────────────────────────────────────────────────

  describe('valid frontmatter', () => {
    it('parses standard key/value pairs', () => {
      const text = '---\nid: T-001\ntitle: My task\nstatus: Done\n---\n\n# Body\n';
      const result = parseFile('board/T-001.md', text);
      expect(result.path).toBe('board/T-001.md');
      expect(result.data).toEqual({ id: 'T-001', title: 'My task', status: 'Done' });
      expect(result.body).toBe('\n# Body\n');
      expect(result.errors).toEqual([]);
    });

    it('parses double-quoted values (including embedded colons)', () => {
      const text = '---\ntitle: "A title: with colon"\n---\n';
      const result = parseFile('doc.md', text);
      expect(result.data['title']).toBe('A title: with colon');
      expect(result.errors).toEqual([]);
    });

    it('parses single-quoted values', () => {
      const text = "---\nkey: 'it''s a value'\n---\n";
      const result = parseFile('doc.md', text);
      expect(result.data['key']).toBe("it's a value");
      expect(result.errors).toEqual([]);
    });

    it('parses boolean and null values', () => {
      const text = '---\nflag: true\ndisabled: false\nempty: null\n---\n';
      const result = parseFile('doc.md', text);
      expect(result.data).toEqual({ flag: true, disabled: false, empty: null });
      expect(result.errors).toEqual([]);
    });

    it('parses an inline sequence', () => {
      const text = '---\ntags: [alpha, beta, gamma]\n---\n';
      const result = parseFile('doc.md', text);
      expect(result.data['tags']).toEqual(['alpha', 'beta', 'gamma']);
      expect(result.errors).toEqual([]);
    });

    it('parses a block-style sequence', () => {
      const text = '---\ntags:\n  - alpha\n  - beta\n---\n';
      const result = parseFile('doc.md', text);
      expect(result.data['tags']).toEqual(['alpha', 'beta']);
      expect(result.errors).toEqual([]);
    });

    it('parses a nested mapping', () => {
      const text = '---\nmeta:\n  added: 2026-06-07\n  by: mozart\n---\n';
      const result = parseFile('doc.md', text);
      expect(result.data['meta']).toEqual({ added: '2026-06-07', by: 'mozart' });
      expect(result.errors).toEqual([]);
    });

    it('strips inline comments from values', () => {
      const text = '---\npriority: P0  # highest\n---\n';
      const result = parseFile('doc.md', text);
      expect(result.data['priority']).toBe('P0');
      expect(result.errors).toEqual([]);
    });

    it('preserves datetime strings as plain strings', () => {
      const text = '---\ncreated: 2026-06-07T13:00:00Z\nupdated: 2026-06-08T09:00:00Z\n---\n';
      const result = parseFile('doc.md', text);
      expect(result.data['created']).toBe('2026-06-07T13:00:00Z');
      expect(result.data['updated']).toBe('2026-06-08T09:00:00Z');
      expect(result.errors).toEqual([]);
    });

    it('parses a realistic card frontmatter block', () => {
      const text =
        '---\n' +
        'id: F-001-S-01\n' +
        'type: story\n' +
        'title: Parse a markdown file and its frontmatter\n' +
        'status: Planned\n' +
        'priority: P0\n' +
        'owner: mozart\n' +
        'sprint: S1\n' +
        'parent: F-001\n' +
        'estimate: M\n' +
        'created: 2026-06-07T13:00:00Z\n' +
        'updated: 2026-06-07T13:00:00Z\n' +
        '---\n' +
        '\n# F-001-S-01 — Title\n';
      const result = parseFile('board/F-001-S-01.md', text);
      expect(result.data['id']).toBe('F-001-S-01');
      expect(result.data['type']).toBe('story');
      expect(result.data['priority']).toBe('P0');
      expect(result.data['parent']).toBe('F-001');
      expect(result.errors).toEqual([]);
    });
  });

  // ── no frontmatter ─────────────────────────────────────────────────────────

  describe('no frontmatter', () => {
    it('returns empty data and full text as body when there is no frontmatter', () => {
      const text = '# Just a title\n\nSome content.';
      const result = parseFile('doc.md', text);
      expect(result.data).toEqual({});
      expect(result.body).toBe(text);
      expect(result.errors).toEqual([]);
    });

    it('returns full text as body when the opening fence is not at byte 0', () => {
      const text = ' ---\nfoo: bar\n---\n# body';
      const result = parseFile('doc.md', text);
      expect(result.data).toEqual({});
      expect(result.body).toBe(text);
      expect(result.errors).toEqual([]);
    });

    it('returns full text as body when there is no closing fence', () => {
      const text = '---\nfoo: bar\n';
      const result = parseFile('doc.md', text);
      expect(result.data).toEqual({});
      expect(result.body).toBe(text);
      expect(result.errors).toEqual([]);
    });

    it('handles an empty file', () => {
      const result = parseFile('doc.md', '');
      expect(result.data).toEqual({});
      expect(result.body).toBe('');
      expect(result.errors).toEqual([]);
    });

    it('recognises an empty frontmatter block and strips it from the body', () => {
      const text = '---\n---\n# body';
      const result = parseFile('doc.md', text);
      expect(result.data).toEqual({});
      expect(result.body).toBe('# body');
      expect(result.errors).toEqual([]);
    });
  });

  // ── malformed YAML ─────────────────────────────────────────────────────────

  describe('malformed YAML', () => {
    it('reports an error (prefixed "yaml:") and returns data: {} for a line with no colon', () => {
      const text = '---\nthis is not yaml\n---\n# body';
      const result = parseFile('doc.md', text);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/^yaml:/);
      expect(result.data).toEqual({});
    });

    it('reports an error and returns data: {} for a structurally invalid block', () => {
      // A key with no value followed by a bare line is a YAML syntax error;
      // per the card contract a parse failure yields data: {} plus an error.
      const text = '---\nid: T-001\nnot yaml\n---\nbody';
      const result = parseFile('doc.md', text);
      expect(result.data).toEqual({});
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/^yaml:/);
    });

    it('reports an error when frontmatter is not a mapping', () => {
      const text = '---\n- just\n- a\n- list\n---\n# body';
      const result = parseFile('doc.md', text);
      expect(result.data).toEqual({});
      expect(result.errors[0]).toMatch(/^yaml:/);
    });

    it('does not throw on malformed input', () => {
      const text = '---\n!!bad: >\n  multiline\n---\n';
      expect(() => parseFile('doc.md', text)).not.toThrow();
    });
  });

  // ── CRLF line endings ──────────────────────────────────────────────────────

  describe('CRLF line endings', () => {
    it('parses frontmatter with CRLF line endings', () => {
      const text = '---\r\nid: T-001\r\ntitle: My task\r\n---\r\n\r\n# Body\r\n';
      const result = parseFile('doc.md', text);
      expect(result.data).toEqual({ id: 'T-001', title: 'My task' });
      expect(result.errors).toEqual([]);
    });

    it('preserves CRLF bytes verbatim in the body', () => {
      const text = '---\r\nid: T-001\r\n---\r\n\r\n# Body\r\n';
      const result = parseFile('doc.md', text);
      expect(result.body).toBe('\r\n# Body\r\n');
    });
  });

  // ── body preservation ──────────────────────────────────────────────────────

  describe('body preservation', () => {
    it('returns the body verbatim (no trimming or rewriting)', () => {
      const body = '\n\n# Title\n\nsome **bold** text.\n\n    code block\n';
      const text = `---\nid: T-001\n---\n${body}`;
      const result = parseFile('doc.md', text);
      expect(result.body).toBe(body);
    });

    it('returns an empty string body for a file that ends at the closing fence', () => {
      const text = '---\nid: T-001\n---\n';
      const result = parseFile('doc.md', text);
      expect(result.body).toBe('');
    });

    it('preserves body with special characters and markdown syntax', () => {
      const body = '# Title\n\n> blockquote\n\n```ts\nconst x = 1;\n```\n';
      const text = `---\nid: T-001\n---\n${body}`;
      const result = parseFile('doc.md', text);
      expect(result.body).toBe(body);
    });
  });
});
