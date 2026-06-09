import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import type { VaultModel } from './models.js';
import { resolveReferences } from './references.js';

function baseModel(): VaultModel {
  return {
    cards: {
      'F-002': {
        id: 'F-002',
        type: 'feature',
        title: 'Config and card types',
        status: 'Planned',
        path: 'board/F-002-config-and-types.md',
      },
      'X-42': {
        id: 'X-42',
        type: 'task',
        title: 'Synthetic card',
        status: 'Todo',
        path: 'board/X-42.md',
      },
    },
    files: ['docs/ADR-001-core-is-pure.md'],
  };
}

function configWithIdPattern(idPattern: string) {
  const { config, errors } = loadConfig({
    board: { columns: ['Backlog', 'Done'] },
    references: { idPattern },
    types: {},
  });
  expect(errors).toEqual([]);
  return config;
}

describe('resolveReferences', () => {
  it('resolves bare ids by id even when no markdown link exists', () => {
    const refs = resolveReferences(
      'See F-002 for config behavior.',
      baseModel(),
      configWithIdPattern('[A-Z]-\\d{3}'),
    );

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      id: 'F-002',
      unresolved: false,
      target: { kind: 'card', path: 'board/F-002-config-and-types.md' },
    });
  });

  it('resolves markdown-link and bare-id mentions side by side', () => {
    const refs = resolveReferences(
      'See [F-002](../board/F-002-old-name.md), then F-002 again.',
      baseModel(),
      configWithIdPattern('[A-Z]-\\d{3}'),
    );

    expect(refs.map((r) => r.id)).toEqual(['F-002', 'F-002']);
    expect(refs.every((r) => r.target?.path === 'board/F-002-config-and-types.md')).toBe(true);
  });

  it('resolves by id after a file rename (path mismatch in markdown href)', () => {
    const model = baseModel();
    model.cards['F-002']!.path = 'board/F-002-renamed.md';

    const refs = resolveReferences(
      'See [F-002](../board/F-002-old-name.md).',
      model,
      configWithIdPattern('[A-Z]-\\d{3}'),
    );

    expect(refs).toHaveLength(1);
    expect(refs[0]?.target?.path).toBe('board/F-002-renamed.md');
  });

  it('keeps unresolved ids in the result instead of dropping or throwing', () => {
    const refs = resolveReferences(
      'Depends on F-999 before starting.',
      baseModel(),
      configWithIdPattern('[A-Z]-\\d{3}'),
    );

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ id: 'F-999', unresolved: true });
    expect(refs[0]?.target).toBeUndefined();
  });

  it('uses the config regex for id shape (no hardcoded F/T prefix)', () => {
    const refs = resolveReferences(
      'Targets: F-002 and X-42.',
      baseModel(),
      configWithIdPattern('X-\\d+'),
    );

    expect(refs).toHaveLength(1);
    expect(refs[0]?.id).toBe('X-42');
    expect(refs[0]?.target?.path).toBe('board/X-42.md');
  });
});
