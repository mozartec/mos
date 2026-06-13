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
import { globToRegExp } from '../packages/core/src/path-glob.js';

const IGNORE = new Set(['node_modules', '.git', '.angular', '.turbo', 'dist', '.cache']);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function unquote(v) {
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
    ? v.slice(1, -1)
    : v;
}

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return null;
  const obj = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const mm = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(lines[i]);
    if (!mm) continue;
    const v = mm[2].trim();
    if (v === '') {
      // A bare `key:` may introduce a block-style list (VAULT_SPEC §5a):
      //   key:
      //     - entry
      const items = [];
      for (let item; i + 1 < lines.length && (item = /^\s*-\s*(.*)$/.exec(lines[i + 1])); i++) {
        items.push(unquote(item[1].trim()));
      }
      obj[mm[1]] = items.length > 0 ? items : v;
    } else {
      obj[mm[1]] = unquote(v);
    }
  }
  return obj;
}

// The shipped default frontmatter order (F-013); config `fieldOrder` overrides it.
const DEFAULT_FIELD_ORDER = [
  'id', 'type', 'title', 'status', 'priority', 'phase', 'owner', 'sprint',
  'parent', 'estimate', 'dependsOn', 'touches', 'created', 'updated',
];

// A frontmatter list value, deduped: a block list (already an array from
// parseFrontmatter), an inline `[a, b]` — entries may be quoted, but a quoted
// entry containing a comma is beyond this interim parser — or a bare single
// value; null when absent.
function parseList(raw) {
  if (raw == null || raw === '') return null;
  if (Array.isArray(raw)) return [...new Set(raw)];
  const inline = /^\[(.*)\]$/.exec(raw);
  const items = inline
    ? inline[1].split(',').map((s) => unquote(s.trim())).filter(Boolean)
    : [raw];
  return [...new Set(items)];
}

// Values an enum `source` supplies: a config list's entries, or a config map's keys.
function sourceValues(cfg, source) {
  if (typeof source !== 'string' || !Object.hasOwn(cfg, source)) return null;
  const src = cfg[source];
  if (Array.isArray(src)) return src;
  if (src !== null && typeof src === 'object') return Object.keys(src);
  return null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// A real ISO YYYY-MM-DD calendar date (rejects shapes like 2026-13-99).
function validIsoDate(s) {
  return typeof s === 'string' && ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

// Raw board-scope values (§5d, ADR-020): an explicit board.scopeField (inline
// `values`, else a `source` config list/map), or the 0.3 `sprints` alias.
// `{ values: null }` means the vault is unscoped.
function scopeRawValues(cfg) {
  const field = cfg.board?.scopeField;
  if (field !== undefined) {
    const def = (cfg.fields ?? {})[field];
    if (!def || typeof def !== 'object')
      return { error: `board.scopeField: '${field}' is not a registered field` };
    if (def.type !== 'enum') return { error: `board.scopeField: field '${field}' must be an enum` };
    if (Array.isArray(def.values) && def.values.length) return { values: def.values };
    if (typeof def.source === 'string' && Object.hasOwn(cfg, def.source)) {
      const src = cfg[def.source];
      if (Array.isArray(src)) return { values: src };
      if (src !== null && typeof src === 'object') return { values: Object.keys(src) };
    }
    return { values: [] };
  }
  if (Array.isArray(cfg.sprints) && cfg.sprints.length) return { values: cfg.sprints };
  return { values: null };
}

// Validate the board scope: accept string or dated { name, starts?, ends? }
// values, flag malformed/inverted dates (errors), and warn on overlapping
// windows. A scope-less vault is checked and left warning-free.
function validateScope(cfg, errors, warnings) {
  const { values, error } = scopeRawValues(cfg);
  if (error) {
    errors.push(error);
    return;
  }
  if (values == null) return; // unscoped

  const dated = [];
  for (const entry of values) {
    if (typeof entry === 'string') continue; // dateless value, fine
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`board scope: value ${JSON.stringify(entry)} must be a string or { name, starts?, ends? }`);
      continue;
    }
    const name = entry.name;
    if (typeof name !== 'string' || name === '') {
      errors.push('board scope: a value is missing a name');
      continue;
    }
    for (const key of ['starts', 'ends']) {
      if (entry[key] != null && !validIsoDate(entry[key]))
        errors.push(`board scope '${name}': ${key} '${entry[key]}' is not a valid ISO date (YYYY-MM-DD)`);
    }
    const s = validIsoDate(entry.starts) ? Date.parse(`${entry.starts}T00:00:00Z`) : null;
    const e = validIsoDate(entry.ends) ? Date.parse(`${entry.ends}T00:00:00Z`) : null;
    if (s != null && e != null) {
      if (s > e) errors.push(`board scope '${name}': starts '${entry.starts}' is after ends '${entry.ends}'`);
      else dated.push({ name, s, e });
    }
  }

  dated.sort((a, b) => a.s - b.s);
  for (let i = 0; i < dated.length; i++)
    for (let j = i + 1; j < dated.length; j++)
      if (dated[i].s <= dated[j].e && dated[j].s <= dated[i].e)
        warnings.push(`board scope '${dated[i].name}' and '${dated[j].name}' have overlapping dates`);
}

function validateVault(root) {
  const errors = [];
  const warnings = [];
  const cfg = JSON.parse(readFileSync(join(root, '.mos', 'config.json'), 'utf8'));
  const types = cfg.types;
  const columns = cfg.board.columns;
  const includes = (cfg.board.include || []).map(globToRegExp);
  // Timestamp fields are config-driven (meta.timestamps); they're optional, but when present
  // must be UTC ISO 8601 with the `Z` designator — not a local time or a +hh:mm offset (ADR-010).
  const tsFields = [
    cfg.meta?.timestamps?.createdField ?? 'created',
    cfg.meta?.timestamps?.updatedField ?? 'updated',
  ];
  const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

  for (const [tn, t] of Object.entries(types)) {
    if (t.parent != null) {
      if (!types[t.parent]) errors.push(`type ${tn}: parent type '${t.parent}' is not defined`);
      else if (types[t.parent].parent != null)
        errors.push(`type ${tn}: parent '${t.parent}' itself has a parent (nesting > 1)`);
    }
    for (const [st, col] of Object.entries(t.states)) {
      if (col != null && !columns.includes(col))
        errors.push(`type ${tn}: state '${st}' maps to unknown column '${col}'`);
    }
  }

  // Board scope (§5d, ADR-020): scopeField / dated values / 0.3 sprints alias.
  validateScope(cfg, errors, warnings);

  // Allowed values per list-enum field (F-024, ADR-021), resolved once: a
  // declared `values` list, the resolved source, or — when the declared
  // source names no config key — the empty set, so every declared value is
  // flagged rather than the whole check silently skipped.
  const listEnumAllowed = new Map();
  for (const [fieldName, def] of Object.entries(cfg.fields ?? {})) {
    if (def?.type !== 'enum' || def?.list !== true) continue;
    const allowed =
      Array.isArray(def.values) && def.values.length > 0
        ? def.values
        : def.source !== undefined
          ? (sourceValues(cfg, def.source) ?? [])
          : null;
    if (allowed != null)
      listEnumAllowed.set(fieldName, { allowed: new Set(allowed), source: def.source });
  }

  const cards = {};
  for (const f of walk(root).filter((f) => f.endsWith('.md'))) {
    const rel = relative(root, f).split(sep).join('/');
    if (!includes.some((re) => re.test(rel))) continue;
    const data = parseFrontmatter(readFileSync(f, 'utf8'));
    if (!data || !types[data.type]) continue; // not a card
    if (!data.id || typeof data.id !== 'string') {
      errors.push(`${rel}: card has no scalar id`);
      continue;
    }
    if (cards[data.id]) errors.push(`duplicate id '${data.id}' (${rel})`);
    cards[data.id] = { ...data, _rel: rel };
  }

  for (const c of Object.values(cards)) {
    const t = types[c.type];
    if (!(c.status in t.states))
      errors.push(`${c.id}: status '${c.status}' not allowed for type '${c.type}'`);
    if (c.parent != null) {
      if (typeof c.parent !== 'string')
        errors.push(`${c.id}: parent is not a single id`);
      else if (t.parent == null) errors.push(`${c.id}: type '${c.type}' may not have a parent`);
      else if (!cards[c.parent]) errors.push(`${c.id}: parent '${c.parent}' not found`);
      else if (cards[c.parent].type !== t.parent)
        errors.push(
          `${c.id}: parent '${c.parent}' is type '${cards[c.parent].type}', expected '${t.parent}'`,
        );
    }
    for (const field of tsFields) {
      const v = c[field];
      if (v == null || v === '') continue; // timestamps are optional
      if (typeof v !== 'string' || !UTC_ISO.test(v) || Number.isNaN(Date.parse(v)))
        errors.push(`${c.id}: ${field} '${v}' is not UTC ISO 8601 (expected e.g. 2026-06-08T09:00:00Z)`);
    }
    // Every id in a list-of-id field (e.g. dependsOn, F-012-S-01) must resolve to a card.
    for (const [fieldName, def] of Object.entries(cfg.fields ?? {})) {
      if (def?.type !== 'id' || def?.list !== true) continue;
      for (const id of parseList(c[fieldName]) ?? []) {
        if (!cards[id]) errors.push(`${c.id}: ${fieldName} '${id}' does not resolve to a card`);
      }
    }
    // Every value of a list-enum field must come from its declared values or
    // source — the list analogue of the id check above (F-024, ADR-021; e.g.
    // a `touches` entry that names no configured area).
    for (const [fieldName, { allowed, source }] of listEnumAllowed) {
      for (const v of parseList(c[fieldName]) ?? []) {
        if (!allowed.has(v))
          errors.push(
            `${c.id}: ${fieldName} '${v}' is not a value of ${source !== undefined ? `config '${source}'` : 'its enum'}`,
          );
      }
    }
    // §5c fallback: `touches` is the spec's conventional surface field. When
    // the registry doesn't already type it as a list enum, its entries must
    // still name configured areas — a vault using touches without areas is
    // half-configured, not exempt.
    if (!listEnumAllowed.has('touches')) {
      for (const name of parseList(c.touches) ?? []) {
        if (!Object.hasOwn(cfg.areas ?? {}, name))
          errors.push(`${c.id}: touches '${name}' names no configured area`);
      }
    }
    // Frontmatter property order (F-013): a warning, never an error.
    const fieldOrder = Array.isArray(cfg.fieldOrder) ? cfg.fieldOrder : DEFAULT_FIELD_ORDER;
    const present = Object.keys(c).filter((k) => k !== '_rel' && fieldOrder.includes(k));
    const expected = fieldOrder.filter((k) => present.includes(k));
    if (present.join(' ') !== expected.join(' '))
      warnings.push(`${c.id}: frontmatter keys out of order (expected ${expected.join(', ')})`);
  }

  // Two cards concurrently in flight — in the column before the last, the
  // counterpart of "last column is done" — that declare overlapping areas are
  // heading for the same files (F-024, ADR-021). A warning, never an error.
  // `touches` is the spec's conventional surface field (VAULT_SPEC §5c),
  // mirroring core's TOUCHES_FIELD, the way `dependsOn` is the deps convention.
  const inFlightCol = columns.length >= 3 ? columns[columns.length - 2] : null;
  if (inFlightCol != null) {
    const inFlight = Object.values(cards)
      .filter((c) => types[c.type].states[c.status] === inFlightCol)
      .map((c) => ({ id: c.id, areas: parseList(c.touches) ?? [] }))
      .sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < inFlight.length; i++) {
      for (let j = i + 1; j < inFlight.length; j++) {
        const shared = inFlight[i].areas.filter((a) => inFlight[j].areas.includes(a));
        if (shared.length)
          warnings.push(
            `${inFlight[i].id} and ${inFlight[j].id}: both in '${inFlightCol}' and declare overlapping area(s): ${shared.join(', ')}`,
          );
      }
    }
  }

  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const board = Object.fromEntries(columns.map((c) => [c, []]));
  const hidden = [];
  for (const c of Object.values(cards)) {
    const col = types[c.type].states[c.status];
    (col == null ? hidden : board[col]).push(c);
  }
  for (const col of columns)
    board[col].sort(
      (a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || a.id.localeCompare(b.id),
    );

  const name = cfg.vault?.name ?? root;
  console.log(
    `\n${'='.repeat(60)}\nVAULT: ${name}  (specVersion ${cfg.specVersion ?? '?'}, ${Object.keys(cards).length} cards)\n${'='.repeat(60)}`,
  );
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
    for (const c of hidden)
      console.log(`    ${c.id.padEnd(12)} ${(c.status ?? '').padEnd(9)} ${c.title ?? ''}`);
  }
  if (warnings.length) {
    console.log(`\n  WARNINGS (${warnings.length}, non-fatal):`);
    for (const w of warnings) console.log(`    ! ${w}`);
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
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (IGNORE.has(name) || name === '.mos') continue;
      let st;
      try {
        st = statSync(join(dir, name));
      } catch {
        continue;
      }
      if (st.isDirectory()) rec(join(dir, name));
    }
  })(start);
  return found;
}

const args = process.argv.slice(2);
const roots = args.length ? args : discover(process.cwd());
if (!roots.length) {
  console.error('No vault found (no .mos/config.json under cwd).');
  process.exit(2);
}
let total = 0;
for (const r of roots) total += validateVault(r);
console.log(`\n${total === 0 ? 'ALL VAULTS VALID' : total + ' ERROR(S)'}\n`);
process.exit(total === 0 ? 0 : 1);
