import { describe, expect, it } from 'vitest';
import { createEmptyVaultModel } from './models.js';

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
