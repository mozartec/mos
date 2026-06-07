import { Injectable } from '@angular/core';
import type { VaultSource } from '@mos/core';

/**
 * A hardcoded, in-memory {@link VaultSource} used to render the app shell before
 * a real filesystem source exists (`apps/dev-server` + `HttpVaultSource` arrive
 * in T-002). It reads nothing from disk and writes nothing — the sample below is
 * the whole "vault" (ADR-002: the app is read-only).
 */
@Injectable({ providedIn: 'root' })
export class StaticVaultSource implements VaultSource {
  private readonly files: Record<string, string> = {
    'docs/welcome.md': '# Welcome\n\nA hardcoded sample vault for the app shell.\n',
    'board/T-001-sample.md':
      '---\nid: T-001\ntype: task\nstatus: In Progress\n---\n\n# Sample task\n',
  };

  listFiles(): Promise<string[]> {
    return Promise.resolve(Object.keys(this.files));
  }

  readFile(path: string): Promise<string> {
    const contents = this.files[path];
    return contents === undefined
      ? Promise.reject(new Error(`No such file: ${path}`))
      : Promise.resolve(contents);
  }

  watch(): () => void {
    // The static sample never changes, so there is nothing to subscribe to;
    // the returned unsubscribe is a no-op.
    return () => undefined;
  }
}
