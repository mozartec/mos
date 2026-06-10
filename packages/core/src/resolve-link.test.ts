import { describe, it, expect } from 'vitest';
import { resolveRelativeLink } from './resolve-link.js';

describe('resolveRelativeLink', () => {
  it("resolves a same-folder link against the current file's folder", () => {
    expect(resolveRelativeLink('docs/00-README.md', '05-VAULT_SPEC.md')).toBe(
      'docs/05-VAULT_SPEC.md',
    );
  });

  it('resolves a cross-folder ../ link', () => {
    expect(resolveRelativeLink('board/F-017-relative-links.md', '../docs/03-ARCHITECTURE.md')).toBe(
      'docs/03-ARCHITECTURE.md',
    );
  });

  it('resolves a root-relative path from a root-level file', () => {
    expect(resolveRelativeLink('README.md', 'board/T-008-publish-cli.md')).toBe(
      'board/T-008-publish-cli.md',
    );
  });

  it('honors an explicit ./ prefix', () => {
    expect(resolveRelativeLink('docs/00-README.md', './05-VAULT_SPEC.md')).toBe(
      'docs/05-VAULT_SPEC.md',
    );
  });

  it('collapses interior ./ and // segments', () => {
    expect(resolveRelativeLink('docs/a.md', './sub/.//b.md')).toBe('docs/sub/b.md');
  });

  it('resolves a leading slash from the vault root', () => {
    expect(resolveRelativeLink('docs/deep/nested/a.md', '/docs/b.md')).toBe('docs/b.md');
  });

  it('returns null when .. escapes the vault root', () => {
    expect(resolveRelativeLink('docs/a.md', '../../etc/passwd')).toBeNull();
    expect(resolveRelativeLink('README.md', '../outside.md')).toBeNull();
  });

  it('strips a #fragment before resolving', () => {
    expect(resolveRelativeLink('docs/a.md', 'b.md#some-heading')).toBe('docs/b.md');
  });

  it('strips a ?query before resolving', () => {
    expect(resolveRelativeLink('docs/a.md', 'b.md?raw=1')).toBe('docs/b.md');
  });

  it('decodes percent-encoded spaces', () => {
    expect(resolveRelativeLink('docs/a.md', 'my%20notes.md')).toBe('docs/my notes.md');
  });

  it('returns null for a pure in-page anchor', () => {
    expect(resolveRelativeLink('docs/a.md', '#heading')).toBeNull();
  });

  it('returns null for external schemes and protocol-relative URLs', () => {
    expect(resolveRelativeLink('docs/a.md', 'https://example.com/b.md')).toBeNull();
    expect(resolveRelativeLink('docs/a.md', 'mailto:someone@example.com')).toBeNull();
    expect(resolveRelativeLink('docs/a.md', '//example.com/b.md')).toBeNull();
  });

  it('returns null for malformed percent-encoding', () => {
    expect(resolveRelativeLink('docs/a.md', 'bad%2.md')).toBeNull();
  });

  it('returns null for an empty href', () => {
    expect(resolveRelativeLink('docs/a.md', '')).toBeNull();
  });

  it('resolves from the root when the current file is at the root', () => {
    expect(resolveRelativeLink('README.md', 'AGENTS.md')).toBe('AGENTS.md');
  });
});
