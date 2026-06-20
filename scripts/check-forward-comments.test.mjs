// check-forward-comments.test.mjs — pin the ADR-023 guard's contract (T-019).
//
// Run under Bun, matching the other script test:
//   bun test scripts/check-forward-comments.test.mjs   # or: bun run test:scripts
//
// Every fixture is a string fed to findForwardComments, so this file touches no
// real source tree. Marker words live only inside those string fixtures, never
// in this file's own comments, so the guard stays green when it scans itself.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findForwardComments, collectFiles } from './check-forward-comments.mjs';

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function makeTmp() {
  const d = mkdtempSync(join(tmpdir(), 'mos-fwd-'));
  tmpDirs.push(d);
  return d;
}

test('flags a forward-looking comment that carries no card id', () => {
  const findings = findForwardComments('// stubbed for now\nconst a = 1;\n');
  assert.equal(findings.length, 1);
  assert.match(findings[0].marker, /for now/i);
});

test('passes the same comment once it cites a card id', () => {
  assert.equal(findForwardComments('// stubbed for now, until F-123\n').length, 0);
});

test('flags every acronym marker (case-sensitive)', () => {
  for (const tag of ['TODO', 'FIXME', 'XXX', 'HACK', 'TBD']) {
    assert.equal(findForwardComments(`// ${tag}: wire this up\n`).length, 1, tag);
  }
});

test('flags representative phrase markers', () => {
  const phrases = [
    '// the future shape of the API',
    '// an interim shim',
    '// a temporary workaround',
    '// drop this eventually',
    '// someday this moves',
    '// fix down the line',
    '// graduates into core',
  ];
  for (const body of phrases) {
    assert.equal(findForwardComments(body + '\n').length, 1, body);
  }
});

test('does not flag present-tense words that merely look ahead', () => {
  // "will" and "later" are deliberately not markers
  assert.equal(findForwardComments('// the parser will throw on bad input\n').length, 0);
  assert.equal(findForwardComments('// validity is checked later in the flow\n').length, 0);
});

test('the Todo status word is not the TODO marker', () => {
  assert.equal(findForwardComments('// maps Todo onto the Backlog column\n').length, 0);
});

test('scans comments only — markers in strings and code are ignored', () => {
  assert.equal(findForwardComments('const s = "TODO: not a comment";\n').length, 0);
  assert.equal(findForwardComments('const future = 1; // a plain note\n').length, 0);
  assert.equal(findForwardComments('fetch("https://example.com/eventually");\n').length, 0);
});

test('a card id anywhere in one comment block is the escape hatch', () => {
  const block = '// this is interim\n// tracked as F-042\nconst a = 1;\n';
  assert.equal(findForwardComments(block).length, 0);
});

test('an ADR id alone does not exempt a forward-looking note', () => {
  assert.equal(findForwardComments('// kept read-only for now (ADR-002)\n').length, 1);
});

test('the escape hatch is per block, not per file', () => {
  const src = '// interim shim\nconst a = 1;\n// see F-042 elsewhere\n';
  assert.equal(findForwardComments(src).length, 1);
});

test('reports the marker line inside a block comment, not the opening line', () => {
  const findings = findForwardComments('/**\n * line two\n * the future here\n */\n');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 3);
});

test('collectFiles accepts a single code file without throwing', () => {
  const f = join(makeTmp(), 'x.ts');
  writeFileSync(f, '// stubbed for now\n');
  assert.deepEqual(collectFiles(f), [f]);
  assert.equal(findForwardComments(readFileSync(f, 'utf8')).length, 1);
});

test('collectFiles walks a directory and applies the extension filter', () => {
  const dir = makeTmp();
  writeFileSync(join(dir, 'a.ts'), '// ok\n');
  writeFileSync(join(dir, 'b.txt'), '// the future here\n');
  const found = collectFiles(dir).map((p) => p.split('/').pop());
  assert.deepEqual(found, ['a.ts']);
});

test('collectFiles skips ignored directories', () => {
  const dir = makeTmp();
  writeFileSync(join(dir, 'kept.ts'), '// ok\n');
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'node_modules', 'dep.ts'), '// the future here\n');
  const found = collectFiles(dir).map((p) => p.split('/').pop());
  assert.deepEqual(found, ['kept.ts']);
});

test('collectFiles skips a non-code file passed explicitly', () => {
  const md = join(makeTmp(), 'notes.md');
  writeFileSync(md, '// the future here\n');
  assert.deepEqual(collectFiles(md), []);
});
