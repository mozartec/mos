#!/usr/bin/env node
// validate-vault.mjs — check a mos vault against its .mos/config.json.
//
// Zero dependencies. Run with Bun or Node:
//   bun run validate            # or: node scripts/validate-vault.mjs
//   node scripts/validate-vault.mjs <vaultDir> [<vaultDir> ...]
//
// With no args it auto-discovers every vault (a directory containing
// .mos/config.json) under the current directory. Exits non-zero if any vault
// has errors, so it doubles as a CI gate.
//
// This is an interim guide for agents working on tasks: run it to confirm the
// board renders as intended before/after editing cards. When packages/core
// lands (F-002), this logic graduates into core with a real parser and tests.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const IGNORE = new Set(['node_modules', '.git', '.angular', '.turbo', 'dist', '.cache']);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function globToRe(glob) {
  let re = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  re = re
    .replace(/\*\*\//g, '§§')
    .replace(/\*\*/g, '§')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/§§/g, '(?:.*/)?')
    .replace(/§/g, '.*');
  return new RegExp('^' + re + '$');
}

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return null;
  const obj = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!mm) continue;
    let v = mm[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    obj[mm[1]] = v;
  }
  return obj;
}

function validateVault(root) {
  const errors = [];
  const cfg = JSON.parse(readFileSync(join(root, '.mos', 'config.json'), 'utf8'));
  const types = cfg.types;
  const columns = cfg.board.columns;
  const includes = (cfg.board.include || []).map(globToRe);

  for (const [tn, t] of Object.entries(types)) {
    if (t.parent != null) {
      if (!types[t.parent]) errors.push(`type ${tn}: parent type '${t.parent}' is not defined`);
      else if (types[t.parent].parent != null) errors.push(`type ${tn}: parent '${t.parent}' itself has a parent (nesting > 1)`);
    }
    for (const [st, col] of Object.entries(t.states)) {
      if (col != null && !columns.includes(col)) errors.push(`type ${tn}: state '${st}' maps to unknown column '${col}'`);
    }
  }

  const cards = {};
  for (const f of walk(root).filter(f => f.endsWith('.md'))) {
    const rel = relative(root, f).split(sep).join('/');
    if (!includes.some(re => re.test(rel))) continue;
    const data = parseFrontmatter(readFileSync(f, 'utf8'));
    if (!data || !types[data.type]) continue; // not a card
    if (!data.id) { errors.push(`${rel}: card has no id`); continue; }
    if (cards[data.id]) errors.push(`duplicate id '${data.id}' (${rel})`);
    cards[data.id] = { ...data, _rel: rel };
  }

  for (const c of Object.values(cards)) {
    const t = types[c.type];
    if (!(c.status in t.states)) errors.push(`${c.id}: status '${c.status}' not allowed for type '${c.type}'`);
    if (c.parent != null) {
      if (t.parent == null) errors.push(`${c.id}: type '${c.type}' may not have a parent`);
      else if (!cards[c.parent]) errors.push(`${c.id}: parent '${c.parent}' not found`);
      else if (cards[c.parent].type !== t.parent) errors.push(`${c.id}: parent '${c.parent}' is type '${cards[c.parent].type}', expected '${t.parent}'`);
    }
  }

  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const board = Object.fromEntries(columns.map(c => [c, []]));
  const hidden = [];
  for (const c of Object.values(cards)) {
    const col = types[c.type].states[c.status];
    (col == null ? hidden : board[col]).push(c);
  }
  for (const col of columns) board[col].sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || a.id.localeCompare(b.id));

  const name = cfg.vault?.name ?? root;
  console.log(`\n${'='.repeat(60)}\nVAULT: ${name}  (specVersion ${cfg.specVersion ?? '?'}, ${Object.keys(cards).length} cards)\n${'='.repeat(60)}`);
  for (const col of columns) {
    console.log(`\n  [${col}] (${board[col].length})`);
    for (const c of board[col]) {
      const badge = c.status === 'Blocked' ? ' *BLOCKED*' : '';
      const par = c.parent ? `  ^${c.parent}` : '';
      console.log(`    ${c.id.padEnd(12)} ${c.priority ?? '--'} ${c.title ?? ''}${par}${badge}`);
    }
  }
  if (hidden.length) {
    console.log(`\n  [hidden/off-board] (${hidden.length})`);
    for (const c of hidden) console.log(`    ${c.id.padEnd(12)} ${(c.status ?? '').padEnd(9)} ${c.title ?? ''}`);
  }
  console.log(errors.length ? `\n  ERRORS (${errors.length}):` : `\n  OK — valid`);
  for (const e of errors) console.log(`    x ${e}`);
  return errors.length;
}

function discover(start) {
  const found = [];
  (function rec(dir) {
    if (existsSync(join(dir, '.mos', 'config.json'))) found.push(dir);
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (IGNORE.has(name) || name === '.mos') continue;
      let st; try { st = statSync(join(dir, name)); } catch { continue; }
      if (st.isDirectory()) rec(join(dir, name));
    }
  })(start);
  return found;
}

const args = process.argv.slice(2);
const roots = args.length ? args : discover(process.cwd());
if (!roots.length) { console.error('No vault found (no .mos/config.json under cwd).'); process.exit(2); }
let total = 0;
for (const r of roots) total += validateVault(r);
console.log(`\n${total === 0 ? 'ALL VAULTS VALID' : total + ' ERROR(S)'}\n`);
process.exit(total === 0 ? 0 : 1);
