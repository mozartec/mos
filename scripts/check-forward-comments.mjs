#!/usr/bin/env bun
// check-forward-comments.mjs — the ADR-023 guard.
//
// In an AI-generated repo a comment is orphaned the moment it's written: the
// agent that wrote it isn't coming back to update it, and the next agent reads
// it as authoritative. A comment that promises work not yet done therefore rots
// into a false claim. This guard scans source-code comments (the JS/TS family)
// for a small, curated set of such markers and fails when one carries no tracked
// card id. The card id is the escape hatch: a note that cites a card (e.g.
// "stubbed until F-002") is allowed, because it points at tracked work rather
// than a bare promise. The rationale lives in docs/08-DECISIONS.md (ADR-023).
//
// Scope is deliberately narrow: comments only (string contents and code are
// skipped), in code files only (markdown prose is not scanned — roadmaps and
// ADRs are meant to talk about what's coming). Run under Bun:
//   bun run check:comments
//   bun scripts/check-forward-comments.mjs [dir ...]
//
// The marker set and id pattern are tuned against this tree so a clean repo
// passes; keep the set small, since a noisy guard gets disabled. The contract is
// pinned in scripts/check-forward-comments.test.mjs.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const IGNORE = new Set([
  'node_modules',
  '.git',
  '.angular',
  '.turbo',
  'dist',
  '.cache',
  'coverage',
]);

// Code files whose `//` and `/* */` are real comments. Markdown is excluded on
// purpose (see the header); JSON has no comments.
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// Acronym markers match case-sensitively (the uppercase convention), so the
// `Todo` status string is never mistaken for a deferred-work tag.
const ACRONYM_MARKERS = ['TODO', 'FIXME', 'XXX', 'HACK', 'TBD'];

// Phrase markers match case-insensitively, with internal spaces allowed to span
// line wraps. `will` and `later` are intentionally excluded: present-tense
// behaviour uses them ("the parser will throw", "validity is checked later in
// the flow"), so flagging them yields a noisy, disabled guard.
const PHRASE_MARKERS = [
  'for now',
  'interim',
  'temporary',
  'temporarily',
  'eventually',
  'someday',
  'down the line',
  'graduates into',
  'graduate into',
  'future',
];

const ACRONYM_RE = new RegExp(`\\b(${ACRONYM_MARKERS.join('|')})\\b`);
const PHRASE_RE = new RegExp(
  `\\b(${PHRASE_MARKERS.map((m) => m.replace(/ /g, '\\s+')).join('|')})\\b`,
  'i',
);

// A card id makes a forward-looking note legitimate: it points at tracked work.
// Only card ids count (features, stories, tasks) — not ADR ids, since an ADR
// records a principle, not the work that would resolve the note. A note citing
// an ADR alone is still flagged; one citing a card (F-050, T-031, F-001-S-02)
// passes.
const CARD_ID_RE = /\b[FT]-\d{2,4}(?:-S-\d{1,3})?\b/;

/**
 * Extract comment groups from source text, skipping string literals so a `//`
 * inside a URL or a `/*` inside a string is never treated as a comment. A
 * character-level scan, not a full parser: single/double-quoted strings reset at
 * a newline (they can't legally span one, and resetting bounds any damage from a
 * regex literal that contains a quote to a single line); template literals are
 * tracked across lines. Contiguous `//` lines are merged into one group, so a
 * card id on an adjacent line still exempts a marker above it.
 *
 * @param {string} text
 * @returns {{ line: number, endLine: number, text: string, kind: 'line' | 'block' }[]}
 */
export function extractCommentGroups(text) {
  const segments = [];
  let i = 0;
  let line = 1;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const d = text[i + 1];
    if (c === '\n') {
      line++;
      i++;
    } else if (c === '/' && d === '/') {
      let j = i + 2;
      let buf = '';
      while (j < n && text[j] !== '\n') buf += text[j++];
      segments.push({ line, text: buf, kind: 'line' });
      i = j;
    } else if (c === '/' && d === '*') {
      const startLine = line;
      let j = i + 2;
      let buf = '';
      while (j < n && !(text[j] === '*' && text[j + 1] === '/')) {
        if (text[j] === '\n') line++;
        buf += text[j++];
      }
      segments.push({ line: startLine, text: buf, kind: 'block' });
      i = j + 2;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
      i = text[j] === c ? j + 1 : j;
    } else if (c === '`') {
      let j = i + 1;
      while (j < n && text[j] !== '`') {
        if (text[j] === '\\') j += 2;
        else {
          if (text[j] === '\n') line++;
          j++;
        }
      }
      i = j + 1;
    } else {
      i++;
    }
  }

  const groups = [];
  for (const seg of segments) {
    const prev = groups[groups.length - 1];
    if (seg.kind === 'line' && prev?.kind === 'line' && prev.endLine === seg.line - 1) {
      prev.text += '\n' + seg.text;
      prev.endLine = seg.line;
    } else {
      groups.push({ line: seg.line, endLine: seg.line, text: seg.text, kind: seg.kind });
    }
  }
  return groups;
}

/**
 * Findings for one file's text: each comment group that carries a marker but no
 * tracked card id. Returns `{ line, marker }` per violation.
 *
 * @param {string} text
 * @returns {{ line: number, marker: string }[]}
 */
export function findForwardComments(text) {
  const findings = [];
  for (const g of extractCommentGroups(text)) {
    if (CARD_ID_RE.test(g.text)) continue;
    const m = g.text.match(ACRONYM_RE) || g.text.match(PHRASE_RE);
    if (!m) continue;
    // Report the marker's own physical line, not the comment's first line — a
    // block comment's group starts at its `/*` but the marker may be lines down.
    const lineOffset = g.text.slice(0, m.index).split('\n').length - 1;
    findings.push({ line: g.line + lineOffset, marker: m[0].replace(/\s+/g, ' ') });
  }
  return findings;
}

function walkDir(dir, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const p = join(dir, entry.name);
    // Recurse via Dirent (not statSync) so symlinks are neither walked nor
    // collected — that avoids cycles through a link back up the tree.
    if (entry.isDirectory()) walkDir(p, acc);
    else if (entry.isFile() && SCAN_EXT.has(extname(entry.name))) acc.push(p);
  }
}

/**
 * Resolve one path argument to the code files to scan. A directory is walked
 * (honouring IGNORE and SCAN_EXT); a single file is included when its extension
 * is in SCAN_EXT — so pointing the guard at one file behaves the same as finding
 * it in a walk, and non-code files (markdown, …) are skipped either way.
 *
 * @param {string} target
 * @param {string[]} acc
 * @returns {string[]}
 */
export function collectFiles(target, acc = []) {
  if (statSync(target).isDirectory()) walkDir(target, acc);
  else if (SCAN_EXT.has(extname(target))) acc.push(target);
  return acc;
}

// CLI entry — gated on import.meta.main so importing this module (the test
// suite) runs no scan, printing, or process.exit.
if (import.meta.main) {
  const args = process.argv.slice(2);
  const roots = args.length ? args : [process.cwd()];
  let total = 0;
  for (const root of roots) {
    for (const file of collectFiles(root)) {
      const rel = relative(process.cwd(), file);
      for (const { line, marker } of findForwardComments(readFileSync(file, 'utf8'))) {
        console.error(`${rel}:${line}  un-carded forward-looking comment ("${marker}")`);
        total++;
      }
    }
  }
  if (total === 0) {
    console.log('OK — no un-carded forward-looking comments');
    process.exit(0);
  }
  console.error(
    `\n${total} forward-looking comment(s) without a card id. ` +
      `Reword to present tense, or cite a card id (e.g. F-123) — see ADR-023.`,
  );
  process.exit(1);
}
