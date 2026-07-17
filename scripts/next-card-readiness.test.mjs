// next-card-readiness.test.mjs — pin the T-032 dependency-resolution behavior.
//
// Run under Bun, matching the other script tests:
//   bun test scripts/next-card-readiness.test.mjs        # or: bun run test:scripts
//
// next_card.py used to read a card's dependencies by scraping body prose for a
// "Depends on" line, ignoring the `dependsOn` frontmatter field mos treats as
// authoritative — a card whose dependencies lived only in frontmatter ranked as ready,
// and an explicit `dependsOn: []` could not override a stale prose line. T-032 ported
// refine_batch.py's precedence (frontmatter authoritative, an explicit `[]` a real
// "none", prose a fallback only when the field is absent). These tests run the script
// against the pick/ship fixture vault and disposable mutated copies, asserting the
// --json contract directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEXT = 'skills/mos-next-card/scripts/next_card.py';
const FIXTURE = 'skills/evals/fixture-vault';

function pickPython() {
  const candidates =
    process.platform === 'win32'
      ? [['py', '-3'], ['python'], ['python3']]
      : [['python3'], ['python'], ['py', '-3']];
  for (const c of candidates) {
    const probe = spawnSync(c[0], [...c.slice(1), '--version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) return c;
  }
  return null;
}

const PY = pickPython();
if (!PY && process.env.CI) {
  throw new Error(
    'next-card-readiness: no Python interpreter found in CI — the T-032 guard cannot run',
  );
}
if (!PY) console.warn('next-card-readiness: no Python interpreter found — skipping');
const t = PY ? test : test.skip;

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function copyFixture() {
  const dest = mkdtempSync(join(tmpdir(), 'mos-next-card-'));
  cpSync(join(REPO, FIXTURE), dest, { recursive: true });
  tmpDirs.push(dest);
  return dest;
}

function runJson(vault) {
  const r = spawnSync(PY[0], [...PY.slice(1), join(REPO, NEXT), vault, '--json'], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, `next_card exited ${r.status}\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

// Rewrite one board card via `edit(text, nl)`, where nl is the file's own newline
// style — on a CRLF checkout (core.autocrlf=true) inserting LF-only lines would leave
// the card with mixed endings instead of the CRLF the parser should be exercised on.
// A no-op edit would quietly turn a test into a baseline rerun, so fail fast instead.
function mutate(vault, file, edit) {
  const path = join(vault, 'board', file);
  const text = readFileSync(path, 'utf8');
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const next = edit(text, nl);
  assert.notEqual(next, text, `mutate: edit left ${file} unchanged`);
  writeFileSync(path, next);
}

const ids = (list) => list.map((c) => c.id);

t('a dependency declared only in frontmatter blocks the card (no prose restatement)', () => {
  const vault = copyFixture();
  // JB-104's body has no "Depends on" prose; declare its dependency in frontmatter only.
  mutate(vault, 'JB-104-tag-index.md', (text, nl) =>
    text.replace(/^touches:.*$/m, `dependsOn: [JB-102]${nl}$&`),
  );
  const j = runJson(vault);
  assert.notEqual(j.recommendation?.id, 'JB-104');
  assert.ok(!ids(j.shortlist).includes('JB-104'), 'JB-104 must not rank as ready');
  const jb104 = j.blocked.find((c) => c.id === 'JB-104');
  assert.deepEqual(jb104?.unmet_deps, ['JB-102'], 'JB-104 must wait on JB-102');
});

t('an explicit `dependsOn: []` wins over a lingering prose line (ready, not blocked)', () => {
  const vault = copyFixture();
  // Frontmatter says "no dependencies"; a stale prose sentence still names JB-104 (unmet).
  mutate(
    vault,
    'JB-102-hello-page.md',
    (text, nl) =>
      text.replace(/^dependsOn:.*$/m, 'dependsOn: []') +
      `${nl}This depends on JB-104 for the tag index.${nl}`,
  );
  const j = runJson(vault);
  assert.equal(j.recommendation?.id, 'JB-102', 'JB-102 must stay the top pick');
  assert.deepEqual(j.recommendation.deps, []);
});

t('frontmatter ids win when the prose disagrees', () => {
  const vault = copyFixture();
  // Frontmatter now depends on JB-104 (unmet); the body prose still says JB-101 (done).
  mutate(vault, 'JB-102-hello-page.md', (text) =>
    text.replace(/^dependsOn:.*$/m, 'dependsOn: [JB-104]'),
  );
  const j = runJson(vault);
  const jb102 = j.blocked.find((c) => c.id === 'JB-102');
  assert.deepEqual(jb102?.deps, ['JB-104'], 'deps must come from frontmatter, not prose');
  assert.deepEqual(jb102?.unmet_deps, ['JB-104']);
});

t('prose is still honored as a fallback when the frontmatter field is absent', () => {
  const vault = copyFixture();
  // Drop JB-103's `dependsOn:` line entirely; its body prose still says JB-104 (unmet).
  mutate(vault, 'JB-103-sync-notes.md', (text) => text.replace(/^dependsOn:[^\n]*\r?\n/m, ''));
  const j = runJson(vault);
  const jb103 = j.blocked.find((c) => c.id === 'JB-103');
  assert.deepEqual(jb103?.deps, ['JB-104'], 'the prose scrape must still resolve deps');
  assert.deepEqual(jb103?.unmet_deps, ['JB-104']);
});

t('cards where prose and frontmatter agree keep the baseline recommendation', () => {
  const j = runJson(join(REPO, FIXTURE));
  assert.equal(j.recommendation?.id, 'JB-102');
  assert.deepEqual(ids(j.shortlist), ['EP-106', 'JB-104']);
  const jb103 = j.blocked.find((c) => c.id === 'JB-103');
  assert.deepEqual(jb103?.deps, ['JB-104'], 'agreeing frontmatter and prose resolve identically');
  assert.deepEqual(jb103?.unmet_deps, ['JB-104']);
});
