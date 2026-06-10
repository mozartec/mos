import { toPosixPath } from './path-glob.js';

/**
 * Resolve a markdown link's `href` against the file it appears in (F-017).
 *
 * Returns the normalized vault-relative POSIX path of the target, or `null`
 * when the href is not a vault-internal path link: external schemes
 * (`http://…`, `mailto:…`), protocol-relative URLs (`//…`), in-page anchors
 * (`#heading`), malformed percent-encoding, and traversals that escape the
 * vault root all yield `null`. Whether the resolved path actually exists is
 * the caller's call to make — this function is pure path arithmetic and never
 * touches a filesystem (ADR-001).
 *
 * Resolution rules (mirroring how GitHub renders relative links, which is the
 * authoring contract — see `docs/05-VAULT_SPEC.md` §7):
 *
 * - `#fragment` and `?query` suffixes are stripped before resolving.
 * - Percent-escapes are decoded (`my%20doc.md` → `my doc.md`).
 * - A leading `/` resolves from the vault root; everything else resolves
 *   against the *folder* of `currentPath`, honoring `./` and `../`.
 */
export function resolveRelativeLink(currentPath: string, href: string): string | null {
  if (href === '') return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return null;

  // Drop the fragment first (a `?` after `#` belongs to the fragment), then
  // the query, then decode what remains.
  let path = href.split('#', 1)[0].split('?', 1)[0];
  if (path === '') return null; // pure in-page anchor or query
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }

  const fromRoot = path.startsWith('/');
  const baseDir = fromRoot ? [] : dirSegments(currentPath);

  const resolved = [...baseDir];
  for (const segment of toPosixPath(path).split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (resolved.length === 0) return null; // escapes the vault root
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.length === 0 ? null : resolved.join('/');
}

/** The folder of a vault-relative path, as POSIX segments (`[]` at the root). */
function dirSegments(path: string): string[] {
  const segments = toPosixPath(path)
    .split('/')
    .filter((s) => s !== '' && s !== '.');
  segments.pop(); // drop the filename itself
  return segments;
}
