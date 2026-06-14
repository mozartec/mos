/**
 * Fetch-style HTTP handler for the read-only vault endpoints (ADR-006):
 *
 *   GET /vault/files              → { files: string[] }   (vault-relative paths)
 *   GET /vault/file?path=<rel>    → file contents as UTF-8 text
 *   GET /vault/watch              → SSE stream of { path: string } change events
 *
 * Runtime-agnostic: it speaks web Request/Response, so Bun.serve can use it
 * directly (apps/dev-server) and a Node http server can adapt it (apps/cli).
 * ADR-002: read-only — no write endpoints, non-GET methods are rejected.
 */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isServedVaultPath, listVaultFiles, safeVaultPath, vaultRelative } from './files';
import { startVaultWatcher, watchPathsFromConfig } from './watcher';

export interface VaultServer {
  /** Handle one request against the /vault/* endpoints. */
  fetch(req: Request): Promise<Response>;
  /** Stop the file watcher and drop all SSE clients. */
  close(): Promise<void>;
}

/** Parse the vault config for the watch allowlist; unreadable → defaults. */
function readWatchPaths(vaultDir: string): string[] {
  let config: unknown = null;
  try {
    config = JSON.parse(readFileSync(join(vaultDir, '.mos', 'config.json'), 'utf-8'));
  } catch {
    // No/invalid config: fall back to the default watch paths.
  }
  return watchPathsFromConfig(config);
}

/** SSE comment sent periodically so idle connections aren't reaped by hosts
 * or proxies with idle timeouts (e.g. Bun.serve defaults to 10s). */
const HEARTBEAT_CHUNK = ': ping\n\n';
const HEARTBEAT_INTERVAL_MS = 25_000;

export function createVaultServer({ vaultDir }: { vaultDir: string }): VaultServer {
  /** Active SSE clients; each writes one raw chunk to its own stream. */
  const clients = new Set<(chunk: string) => void>();

  // A client whose connection died can throw on write; drop it instead of
  // letting the throw abort delivery to the remaining live clients.
  const broadcast = (chunk: string) => {
    for (const send of [...clients]) {
      try {
        send(chunk);
      } catch {
        clients.delete(send);
      }
    }
  };

  const heartbeat = setInterval(() => broadcast(HEARTBEAT_CHUNK), HEARTBEAT_INTERVAL_MS);
  heartbeat.unref?.();

  const stopWatcher = startVaultWatcher({
    vaultDir,
    // The watch scope is config-driven (vault spec §6 `watch`); changing the
    // key takes effect on server restart.
    watchPaths: readWatchPaths(vaultDir),
    onChange(event) {
      broadcast(`data: ${JSON.stringify({ path: event.path })}\n\n`);
    },
  });

  return {
    async fetch(req: Request): Promise<Response> {
      if (req.method !== 'GET') {
        return new Response('Method not allowed (read-only server)', { status: 405 });
      }
      const url = new URL(req.url);

      // ── GET /vault/files ────────────────────────────────────────────────
      if (url.pathname === '/vault/files') {
        const files = await listVaultFiles(vaultDir);
        return Response.json({ files });
      }

      // ── GET /vault/file?path=<rel> ──────────────────────────────────────
      if (url.pathname === '/vault/file') {
        const reqPath = url.searchParams.get('path');
        if (!reqPath) {
          return new Response('Missing path parameter', { status: 400 });
        }

        const full = safeVaultPath(vaultDir, reqPath);
        if (!full) {
          return new Response('Forbidden', { status: 403 });
        }

        // Only serve files in the same allowlist as /vault/files
        if (!isServedVaultPath(vaultRelative(vaultDir, full))) {
          return new Response('Not found', { status: 404 });
        }

        try {
          const content = await readFile(full, 'utf-8');
          return new Response(content, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        } catch {
          return new Response('Not found', { status: 404 });
        }
      }

      // ── GET /vault/watch ────────────────────────────────────────────────
      // SSE endpoint. Keeps the connection open and broadcasts change events.
      if (url.pathname === '/vault/watch') {
        const encoder = new TextEncoder();
        let send: ((chunk: string) => void) | undefined;

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            send = (chunk: string) => {
              controller.enqueue(encoder.encode(chunk));
            };
            clients.add(send);
            // Confirm connection to the client
            controller.enqueue(encoder.encode(': connected\n\n'));
          },
          cancel() {
            if (send) clients.delete(send);
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }

      return new Response('Not found', { status: 404 });
    },

    async close(): Promise<void> {
      clearInterval(heartbeat);
      clients.clear();
      await stopWatcher();
    },
  };
}
