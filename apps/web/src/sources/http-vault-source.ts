import { Injectable } from '@angular/core';
import type { VaultSource } from '@mos/core';

/**
 * {@link VaultSource} implementation backed by `apps/dev-server` (T-002).
 *
 * The Angular dev server proxies `/vault/*` to `http://localhost:3001`, so
 * these fetches are same-origin from the browser's perspective.
 *
 * - `listFiles` and `readFile` use the Fetch API (no direct disk access).
 * - `watch` opens an SSE connection and forwards per-file change events.
 *
 * Swapping back to `StaticVaultSource` for tests requires only a DI binding
 * change in `app.config.ts` — the UI and core are untouched. (ADR-006)
 */
@Injectable({ providedIn: 'root' })
export class HttpVaultSource implements VaultSource {
  async listFiles(): Promise<string[]> {
    const res = await fetch('/vault/files');
    if (!res.ok) throw new Error(`listFiles failed: ${res.status}`);
    const data = (await res.json()) as { files: string[] };
    return data.files;
  }

  async readFile(path: string): Promise<string> {
    const res = await fetch(`/vault/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`readFile failed for "${path}": ${res.status}`);
    return res.text();
  }

  watch(onChange: (path: string) => void): () => void {
    const es = new EventSource('/vault/watch');
    es.onmessage = (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data) as { path: string };
      onChange(data.path);
    };
    return () => es.close();
  }
}
