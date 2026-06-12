import type { VaultSource } from '@mos/core';

/**
 * Shared spec utilities. This file deliberately imports no test framework so
 * the app's type-check (tsconfig.app.json includes all src TS files) stays
 * clean; it is only ever imported from spec files.
 */

/**
 * In-memory {@link VaultSource} for specs: serves a fixed file map and records
 * every interaction so tests can assert on re-parse accounting and watcher
 * lifecycle. The superset of the per-spec stubs it replaces.
 */
export class InMemoryVaultSource implements VaultSource {
  /** Paths handed to readFile, for re-parse accounting. */
  readonly readPaths: string[] = [];
  /** How many watch subscriptions have been disposed. */
  unwatchedCount = 0;
  private readonly watchers: ((path: string) => void)[] = [];

  constructor(readonly files: Record<string, string>) {}

  listFiles(): Promise<string[]> {
    return Promise.resolve(Object.keys(this.files));
  }

  readFile(path: string): Promise<string> {
    this.readPaths.push(path);
    const content = this.files[path];
    return content === undefined
      ? Promise.reject(new Error(`No such file: ${path}`))
      : Promise.resolve(content);
  }

  watch(onChange: (path: string) => void): () => void {
    this.watchers.push(onChange);
    return () => {
      this.unwatchedCount++;
    };
  }

  /** Simulate a file-change event from the dev-server watcher. */
  emit(path: string): void {
    for (const watcher of this.watchers) watcher(path);
  }
}

/**
 * Drain the queued microtask/macrotask rounds of a view's async vault loading,
 * then re-render. Accepts anything fixture-shaped (a ComponentFixture, or a
 * RouterTestingHarness's fixture).
 */
export async function settle(fixture: {
  whenStable(): Promise<unknown>;
  detectChanges(): void;
}): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  fixture.detectChanges();
}
