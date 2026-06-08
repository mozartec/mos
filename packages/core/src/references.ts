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

  for (const link of findMarkdownLinks(body)) {
    const { label, href, spanStart, spanEnd, labelStart, hrefStart } = link;
    occupied.push({ start: spanStart, end: spanEnd });

    const labelHits = findIds(label, idMatcher);
    const hrefHits = findIds(href, idMatcher);
    const linkHits = labelHits.length > 0 ? labelHits : hrefHits;
    const baseStart = labelHits.length > 0 ? labelStart : hrefStart;

    for (const hit of linkHits) {
      addReference(references, seen, hit.id, baseStart + hit.start, baseStart + hit.end, model);
    }
  }

  for (const link of findWikilinks(body)) {
    const { inner, spanStart, spanEnd, innerStart } = link;
    occupied.push({ start: spanStart, end: spanEnd });
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
  matcher.lastIndex = 0;
  while (true) {
    const match = matcher.exec(text);
    if (match === null) break;
    const id = match[0];
    const start = match.index;
    ids.push({ id, start, end: start + id.length });
    if (id.length === 0) matcher.lastIndex += 1;
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
  return ranges.some((r) => start < r.end && end > r.start);
}

function findMarkdownLinks(body: string): Array<{
  label: string;
  href: string;
  spanStart: number;
  spanEnd: number;
  labelStart: number;
  hrefStart: number;
}> {
  const links: Array<{
    label: string;
    href: string;
    spanStart: number;
    spanEnd: number;
    labelStart: number;
    hrefStart: number;
  }> = [];

  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf('[', cursor);
    if (start < 0) break;
    const labelEnd = body.indexOf(']', start + 1);
    if (labelEnd < 0 || body[labelEnd + 1] !== '(') {
      cursor = start + 1;
      continue;
    }
    const hrefEnd = body.indexOf(')', labelEnd + 2);
    if (hrefEnd < 0) {
      cursor = start + 1;
      continue;
    }

    const labelStart = start + 1;
    const hrefStart = labelEnd + 2;
    links.push({
      label: body.slice(labelStart, labelEnd),
      href: body.slice(hrefStart, hrefEnd),
      spanStart: start,
      spanEnd: hrefEnd + 1,
      labelStart,
      hrefStart,
    });
    cursor = hrefEnd + 1;
  }

  return links;
}

function findWikilinks(body: string): Array<{
  inner: string;
  spanStart: number;
  spanEnd: number;
  innerStart: number;
}> {
  const links: Array<{
    inner: string;
    spanStart: number;
    spanEnd: number;
    innerStart: number;
  }> = [];

  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf('[[', cursor);
    if (start < 0) break;
    const end = body.indexOf(']]', start + 2);
    if (end < 0) break;
    links.push({
      inner: body.slice(start + 2, end),
      spanStart: start,
      spanEnd: end + 2,
      innerStart: start + 2,
    });
    cursor = end + 2;
  }

  return links;
}
