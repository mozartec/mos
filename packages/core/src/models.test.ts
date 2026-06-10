import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadConfig, type VaultConfig } from './config.js';
import type { ParsedFile } from './parse-file.js';
import { parseFile } from './parse-file.js';
import { applyFileChange, buildModel, createEmptyVaultModel } from './models.js';

describe('createEmptyVaultModel', () => {
  it('returns a model with no cards and no files', () => {
    const model = createEmptyVaultModel();
    expect(model.cards).toEqual({});
    expect(model.files).toEqual([]);
  });

  it('returns a fresh object each call (no shared mutable state)', () => {
    const a = createEmptyVaultModel();
    const b = createEmptyVaultModel();
    expect(a).not.toBe(b);
    expect(a.files).not.toBe(b.files);
  });
});

describe('buildModel', () => {
  const config: VaultConfig = {
    specVersion: '0.2',
    vault: { name: 'Test Vault' },
    meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
    fields: {},
    wiki: { include: ['**/*.md'], exclude: [], fields: [] },
    board: { include: ['board/**/*.md'], columns: ['Backlog', 'Done'], sortWithinColumn: [] },
    references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*' },
    types: {
      story: { parent: null, states: { Todo: 'Backlog', Done: 'Done' } },
      task: { parent: null, states: { Todo: 'Backlog', Done: 'Done' } },
    },
    sprints: [],
    fieldOrder: [],
  };

  it('keys cards by id, reports duplicate ids, and tracks only wiki-scope file paths', () => {
    const scopedConfig: VaultConfig = {
      ...config,
      wiki: {
        include: ['docs/**/*.md'],
        exclude: ['docs/private/**/*.md'],
        fields: [],
      },
    };

    const files: ParsedFile[] = [
      {
        path: 'board/F-001.md',
        data: { id: 'F-001', type: 'story', title: 'First', status: 'Todo' },
        body: '',
        errors: [],
      },
      {
        path: 'board/F-001-duplicate.md',
        data: { id: 'F-001', type: 'story', title: 'Duplicate', status: 'Done' },
        body: '',
        errors: [],
      },
      {
        path: 'docs/guide.md',
        data: {},
        body: '',
        errors: [],
      },
      {
        path: 'docs/private/secret.md',
        data: {},
        body: '',
        errors: [],
      },
    ];

    const { model, diagnostics } = buildModel(files, scopedConfig);

    expect(Object.keys(model.cards)).toEqual(['F-001']);
    expect(model.cards['F-001']?.title).toBe('First');
    expect(model.files).toEqual(['docs/guide.md']);
    expect(diagnostics).toContain("duplicate id 'F-001' (board/F-001-duplicate.md)");
  });

  it('reports board-scope files with missing/unrecognized type as not a card', () => {
    const files: ParsedFile[] = [
      { path: 'board/notes.md', data: {}, body: '', errors: [] },
      {
        path: 'board/unknown.md',
        data: { type: 'epic' },
        body: '',
        errors: [],
      },
      {
        path: 'docs/typed-note.md',
        data: { type: 'epic' },
        body: '',
        errors: [],
      },
    ];

    const { model, diagnostics } = buildModel(files, config);

    expect(model.cards).toEqual({});
    expect(diagnostics).toEqual([
      'board/notes.md: not a card (unrecognized or missing type)',
      'board/unknown.md: not a card (unrecognized or missing type)',
    ]);
  });

  it('reports recognized cards missing an id', () => {
    const files: ParsedFile[] = [
      {
        path: 'board/no-id.md',
        data: { type: 'task', title: 'Missing ID', status: 'Todo' },
        body: '',
        errors: [],
      },
    ];

    const { model, diagnostics } = buildModel(files, config);

    expect(model.cards).toEqual({});
    expect(diagnostics).toEqual(['board/no-id.md: card has no id']);
  });

  it('coerces scalar frontmatter values to strings for card fields', () => {
    const files: ParsedFile[] = [
      {
        path: 'board/numeric-id.md',
        data: { id: 123, type: 'task', title: 99, status: true },
        body: '',
        errors: [],
      },
    ];

    const { model, diagnostics } = buildModel(files, config);

    expect(diagnostics).toEqual([]);
    expect(model.cards['123']).toEqual({
      id: '123',
      type: 'task',
      title: '99',
      status: 'true',
      path: 'board/numeric-id.md',
      priority: undefined,
      fields: { id: 123, type: 'task', title: 99, status: true },
    });
  });

  it('carries the raw frontmatter values in fields property', () => {
    const files: ParsedFile[] = [
      {
        path: 'board/task-1.md',
        data: { id: 'T-1', type: 'task', title: 'Task 1', status: 'Todo', custom_field: 'hello', count: 5 },
        body: '',
        errors: [],
      },
    ];

    const { model } = buildModel(files, config);
    expect(model.cards['T-1']?.fields).toEqual({
      id: 'T-1',
      type: 'task',
      title: 'Task 1',
      status: 'Todo',
      custom_field: 'hello',
      count: 5,
    });
  });

  it('applies glob include patterns (**, *, ?) against normalized paths', () => {
    const scopedConfig: VaultConfig = {
      ...config,
      board: {
        ...config.board,
        include: ['board/*/item?.md', 'board/**/*.note.md'],
      },
    };

    const files: ParsedFile[] = [
      {
        path: 'board/a/item1.md',
        data: { id: 'C-1', type: 'task', title: 'One', status: 'Todo' },
        body: '',
        errors: [],
      },
      {
        path: 'board\\b\\item2.md',
        data: { id: 'C-2', type: 'task', title: 'Two', status: 'Todo' },
        body: '',
        errors: [],
      },
      {
        path: 'board/a/deep/item3.md',
        data: { id: 'C-3', type: 'task', title: 'Three', status: 'Todo' },
        body: '',
        errors: [],
      },
      {
        path: 'board/x/y/trace.note.md',
        data: { id: 'C-4', type: 'task', title: 'Four', status: 'Todo' },
        body: '',
        errors: [],
      },
    ];

    const { model } = buildModel(files, scopedConfig);

    expect(Object.keys(model.cards).sort()).toEqual(['C-1', 'C-2', 'C-4']);
  });

  it("matches validate-vault's card count for this repository vault", () => {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const vaultRoot = repoRoot;
    const configText = readFileSync(join(vaultRoot, '.mos', 'config.json'), 'utf8');
    const { config: repoConfig, errors } = loadConfig(configText);
    expect(errors).toEqual([]);

    const parsedFiles: ParsedFile[] = walkMarkdownFiles(vaultRoot).map((absPath) => {
      const relPath = relative(vaultRoot, absPath).replaceAll('\\', '/');
      return parseFile(relPath, readFileSync(absPath, 'utf8'));
    });

    const { model } = buildModel(parsedFiles, repoConfig);
    const actualCount = Object.keys(model.cards).length;

    const output = execFileSync(
      process.execPath,
      [join(repoRoot, 'scripts', 'validate-vault.mjs'), vaultRoot],
      { encoding: 'utf8' },
    );
    const match = /\((?:[^,]+,\s*)?(\d+) cards\)/.exec(output);
    expect(match).not.toBeNull();
    const validatorCount = Number(match?.[1]);

    expect(actualCount).toBe(validatorCount);
  });
});

const WALK_IGNORE = new Set(['node_modules', '.git', '.angular', '.turbo', 'dist', '.cache']);

function walkMarkdownFiles(root: string): string[] {
  const files: string[] = [];
  walkInto(root, files);
  return files;
}

function walkInto(dir: string, files: string[]): void {
  for (const name of readdirSync(dir)) {
    if (WALK_IGNORE.has(name)) continue;
    const absPath = join(dir, name);
    let st;
    try {
      st = statSync(absPath);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkInto(absPath, files);
      continue;
    }
    if (absPath.endsWith('.md')) files.push(absPath);
  }
}

describe('applyFileChange', () => {
  const config: VaultConfig = {
    specVersion: '0.2',
    vault: { name: 'Test Vault' },
    meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
    fields: {},
    wiki: { include: ['**/*.md'], exclude: ['secret/**'], fields: [] },
    board: { include: ['board/**/*.md'], columns: ['Backlog', 'Done'], sortWithinColumn: [] },
    references: { idPattern: '[A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*' },
    types: {
      story: { parent: null, states: { Todo: 'Backlog', Done: 'Done' } },
    },
    sprints: [],
    fieldOrder: [],
  };

  function card(path: string, id: string, status: string): ParsedFile {
    return { path, data: { id, type: 'story', title: id, status }, body: '', errors: [] };
  }

  function baseModel() {
    return buildModel(
      [card('board/S-001.md', 'S-001', 'Todo'), card('board/S-002.md', 'S-002', 'Todo')],
      config,
    ).model;
  }

  it('updates a changed card in place (status flip) without touching others', () => {
    const before = baseModel();
    const { model, diagnostics } = applyFileChange(
      before,
      config,
      'board/S-001.md',
      card('board/S-001.md', 'S-001', 'Done'),
    );
    expect(diagnostics).toEqual([]);
    expect(model.cards['S-001']?.status).toBe('Done');
    // untouched card carried over by reference — nothing else was re-parsed
    expect(model.cards['S-002']).toBe(before.cards['S-002']);
  });

  it('does not mutate the input model (signals need a new object)', () => {
    const before = baseModel();
    const { model } = applyFileChange(
      before,
      config,
      'board/S-001.md',
      card('board/S-001.md', 'S-001', 'Done'),
    );
    expect(model).not.toBe(before);
    expect(before.cards['S-001']?.status).toBe('Todo');
  });

  it('adds a newly created file as card and wiki entry', () => {
    const { model } = applyFileChange(
      baseModel(),
      config,
      'board/S-003.md',
      card('board/S-003.md', 'S-003', 'Todo'),
    );
    expect(model.cards['S-003']?.id).toBe('S-003');
    expect(model.files).toContain('board/S-003.md');
  });

  it('removes a deleted file from cards and files', () => {
    const { model } = applyFileChange(baseModel(), config, 'board/S-002.md', null);
    expect(model.cards['S-002']).toBeUndefined();
    expect(model.files).not.toContain('board/S-002.md');
  });

  it('keeps an updated wiki file in its original listing position', () => {
    const before = baseModel();
    expect(before.files).toEqual(['board/S-001.md', 'board/S-002.md']);
    const { model } = applyFileChange(
      before,
      config,
      'board/S-001.md',
      card('board/S-001.md', 'S-001', 'Done'),
    );
    expect(model.files).toEqual(['board/S-001.md', 'board/S-002.md']);
  });

  it('handles a card id moving to a different file (rename) when old file is deleted', () => {
    const afterDelete = applyFileChange(baseModel(), config, 'board/S-001.md', null).model;
    const { model, diagnostics } = applyFileChange(
      afterDelete,
      config,
      'board/S-001-renamed.md',
      card('board/S-001-renamed.md', 'S-001', 'Todo'),
    );
    expect(diagnostics).toEqual([]);
    expect(model.cards['S-001']?.path).toBe('board/S-001-renamed.md');
  });

  it('reports a duplicate id owned by a different file and skips the card', () => {
    const { model, diagnostics } = applyFileChange(
      baseModel(),
      config,
      'board/S-001-copy.md',
      card('board/S-001-copy.md', 'S-001', 'Done'),
    );
    expect(diagnostics.some((d) => d.includes("duplicate id 'S-001'"))).toBe(true);
    expect(model.cards['S-001']?.path).toBe('board/S-001.md');
  });

  it('excluded wiki paths are not added to files', () => {
    const { model } = applyFileChange(baseModel(), config, 'secret/notes.md', {
      path: 'secret/notes.md',
      data: {},
      body: 'hi',
      errors: [],
    });
    expect(model.files).not.toContain('secret/notes.md');
  });
});
