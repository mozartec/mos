import { describe, expect, it } from 'vitest';
import type { VaultConfig } from './config.js';
import type { ParsedFile } from './parse-file.js';
import { buildModel, createEmptyVaultModel } from './models.js';

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
    types: {
      story: { parent: null, states: { Todo: 'Backlog', Done: 'Done' } },
      task: { parent: null, states: { Todo: 'Backlog', Done: 'Done' } },
    },
    sprints: [],
  };

  it('keys cards by id, reports duplicate ids, and tracks all file paths', () => {
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
    ];

    const { model, diagnostics } = buildModel(files, config);

    expect(Object.keys(model.cards)).toEqual(['F-001']);
    expect(model.cards['F-001']?.title).toBe('First');
    expect(model.files).toEqual(['board/F-001.md', 'board/F-001-duplicate.md', 'docs/guide.md']);
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
});
