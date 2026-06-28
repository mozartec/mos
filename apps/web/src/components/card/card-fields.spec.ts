import type { Card, FieldDef, TypeDef } from '@mos/core';
import { buildRenderFields } from './card-fields';

describe('buildRenderFields', () => {
  const typeDef: TypeDef = { parent: null, states: {}, card: { fields: ['dependsOn'] } };
  const registry: Record<string, FieldDef> = {
    dependsOn: { type: 'id', list: true, label: 'Depends on' },
  };

  function cardWith(dependsOn: unknown): Card {
    return {
      id: 'T-001',
      type: 'task',
      title: 'X',
      status: 'Todo',
      path: 'board/T-001.md',
      fields: { dependsOn },
    };
  }

  it('dedups repeated values in a list-of-id field (no NG0955 duplicate track keys)', () => {
    const field = buildRenderFields(cardWith(['T-002', 'T-002', 'T-003']), typeDef, registry).find(
      (f) => f.key === 'dependsOn',
    );
    expect(field?.listValues).toEqual(['T-002', 'T-003']);
  });

  it('keeps a single-id field as a one-element list', () => {
    const field = buildRenderFields(cardWith('T-002'), typeDef, registry).find(
      (f) => f.key === 'dependsOn',
    );
    expect(field?.listValues).toEqual(['T-002']);
  });
});
