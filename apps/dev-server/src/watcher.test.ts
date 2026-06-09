import { describe, expect, it } from 'bun:test';
import {
  createDebouncedEmitter,
  isWatchedRelativePath,
  retryUntilReadable,
  toVaultRelativePath,
  type VaultChangeEvent,
} from './watcher';

describe('isWatchedRelativePath', () => {
  it('accepts markdown files and .mos/config.json', () => {
    expect(isWatchedRelativePath('board/T-004-file-watcher.md')).toBe(true);
    expect(isWatchedRelativePath('.mos/config.json')).toBe(true);
  });

  it('rejects hidden or non-markdown paths', () => {
    expect(isWatchedRelativePath('.tmp.md')).toBe(false);
    expect(isWatchedRelativePath('board/.tmp.md')).toBe(false);
    expect(isWatchedRelativePath('board/T-004-file-watcher.txt')).toBe(false);
  });
});

describe('toVaultRelativePath', () => {
  it('normalizes paths and blocks traversal', () => {
    const vaultDir = '/vault';
    expect(toVaultRelativePath('/vault/board/T-004.md', vaultDir)).toBe('board/T-004.md');
    expect(toVaultRelativePath('/outside/file.md', vaultDir)).toBeNull();
  });
});

describe('retryUntilReadable', () => {
  it('retries after transient read failures', async () => {
    let attempts = 0;
    const ok = await retryUntilReadable('/vault/board/T-004.md', {
      retries: 2,
      delaysMs: [1, 1],
      readText: async () => {
        attempts += 1;
        if (attempts < 2) throw new Error('mid-write');
        return 'ok';
      },
      sleep: async () => undefined,
    });

    expect(ok).toBe(true);
    expect(attempts).toBe(2);
  });
});

describe('createDebouncedEmitter', () => {
  it('coalesces burst events into one event per logical save', async () => {
    const events: VaultChangeEvent[] = [];
    const emit = createDebouncedEmitter((event) => {
      events.push(event);
    }, 10);

    emit({ path: 'board/T-004.md', kind: 'changed' });
    emit({ path: 'board/T-004.md', kind: 'changed' });
    emit({ path: 'board/T-005.md', kind: 'changed' });

    await new Promise<void>((resolve) => setTimeout(resolve, 30));

    expect(events).toEqual([
      { path: 'board/T-004.md', kind: 'changed' },
      { path: 'board/T-005.md', kind: 'changed' },
    ]);
  });

  it('prefers changed over deleted when events are merged', async () => {
    const events: VaultChangeEvent[] = [];
    const emit = createDebouncedEmitter((event) => {
      events.push(event);
    }, 10);

    emit({ path: 'board/T-004.md', kind: 'deleted' });
    emit({ path: 'board/T-004.md', kind: 'changed' });

    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    expect(events).toEqual([{ path: 'board/T-004.md', kind: 'changed' }]);
  });
});
