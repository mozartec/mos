import type { VaultConfig } from './config.js';
import type { VaultModel } from './models.js';

export interface ReferenceTarget {
  kind: 'card' | 'doc';
  path: string;
}

export interface Reference {
  start: number;
  end: number;
  id: string;
  target?: ReferenceTarget;
  unresolved: boolean;
}

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const WIKILINK_RE = /\[\[([^[\]]+)\]\]/g;

export function resolveReferences(
  body: string,
  model: VaultModel,
  config: VaultConfig,
): Reference[] {
  const idMatcher = compileIdMatcher(config.references.idPattern);
  if (idMatcher === null) return [];

  const references: Reference[] = [];
  const occupied: Array<{ start: number; end: number }> = [];
  const seen = new Set<string>();

  for (const match of body.matchAll(MARKDOWN_LINK_RE)) {
    const full = match[0];
    const label = match[1] ?? '';
    const href = match[2] ?? '';
    if (full === undefined || match.index === undefined) continue;

    const spanStart = match.index;
    const spanEnd = spanStart + full.length;
    occupied.push({ start: spanStart, end: spanEnd });

    const labelStart = spanStart + 1; // skip `[`
    const hrefStart = labelStart + label.length + 2; // `](`

    const labelHits = findIds(label, idMatcher);
    const hrefHits = findIds(href, idMatcher);
    const linkHits = labelHits.length > 0 ? labelHits : hrefHits;
    const baseStart = labelHits.length > 0 ? labelStart : hrefStart;

    for (const hit of linkHits) {
      addReference(references, seen, hit.id, baseStart + hit.start, baseStart + hit.end, model);
    }
  }

  for (const match of body.matchAll(WIKILINK_RE)) {
    const full = match[0];
    const inner = match[1] ?? '';
    if (full === undefined || match.index === undefined) continue;

    const spanStart = match.index;
    const spanEnd = spanStart + full.length;
    occupied.push({ start: spanStart, end: spanEnd });

    const innerStart = spanStart + 2; // skip `[[`
    for (const hit of findIds(inner, idMatcher)) {
      addReference(references, seen, hit.id, innerStart + hit.start, innerStart + hit.end, model);
    }
  }

  for (const hit of findIds(body, idMatcher)) {
    if (isInRanges(hit.start, hit.end, occupied)) continue;
    addReference(references, seen, hit.id, hit.start, hit.end, model);
  }

  references.sort((a, b) => a.start - b.start || a.end - b.end);
  return references;
}

function compileIdMatcher(source: string): RegExp | null {
  try {
    return new RegExp(source, 'g');
  } catch {
    return null;
  }
}

function findIds(
  text: string,
  matcher: RegExp,
): Array<{ id: string; start: number; end: number }> {
  const ids: Array<{ id: string; start: number; end: number }> = [];
  const scoped = new RegExp(matcher.source, matcher.flags.includes('g') ? matcher.flags : `${matcher.flags}g`);
  for (const match of text.matchAll(scoped)) {
    const id = match[0];
    const start = match.index;
    if (id === undefined || start === undefined) continue;
    ids.push({ id, start, end: start + id.length });
  }
  return ids;
}

function addReference(
  out: Reference[],
  seen: Set<string>,
  id: string,
  start: number,
  end: number,
  model: VaultModel,
): void {
  const key = `${start}:${end}:${id}`;
  if (seen.has(key)) return;
  seen.add(key);

  const targetPath = resolveById(id, model);
  if (targetPath !== undefined) {
    out.push({
      start,
      end,
      id,
      target: targetPath,
      unresolved: false,
    });
    return;
  }

  out.push({
    start,
    end,
    id,
    unresolved: true,
  });
}

function resolveById(id: string, model: VaultModel): ReferenceTarget | undefined {
  const card = model.cards[id];
  if (card !== undefined) {
    return { kind: 'card', path: card.path };
  }

  const docPath = model.files.find((path) => {
    const slash = path.lastIndexOf('/');
    const file = slash >= 0 ? path.slice(slash + 1) : path;
    return file === `${id}.md` || file.startsWith(`${id}-`);
  });
  if (docPath !== undefined) {
    return { kind: 'doc', path: docPath };
  }

  return undefined;
}

function isInRanges(start: number, end: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some((r) => start >= r.start && end <= r.end);
}
