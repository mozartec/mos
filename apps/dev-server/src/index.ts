/**
 * Dev filesystem server for mos (ADR-006, T-002).
 *
 * Exposes three read-only HTTP endpoints so the Angular dev-server can proxy
 * vault file access through them:
 *
 *   GET /vault/files              → { files: string[] }   (vault-relative paths)
 *   GET /vault/file?path=<rel>    → file contents as UTF-8 text
 *   GET /vault/watch              → SSE stream of { path: string } change events
 *                                    (real watcher wired in T-004; here just the shape)
 *
 * Configuration:
 *   VAULT_DIR  Path to the vault root (default: three levels up from this file,
 *              i.e. the monorepo root when running in apps/dev-server/src/).
 *   PORT       HTTP port (default: 3001).
 *
 * ADR-002: read-only — no write endpoints.
 * ADR-001: all fs access lives here; packages/core gains nothing.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const VAULT_DIR = resolve(process.env['VAULT_DIR'] ?? join(import.meta.dir, '../../..'));
const PORT = Number(process.env['PORT'] ?? '3001');

/** Active SSE client broadcast functions. */
const clients = new Set<(path: string) => void>();

// ---------------------------------------------------------------------------
// File listing
// ---------------------------------------------------------------------------

/** Recursively collect vault-relative paths of .md files and .mos/config.json. */
async function listVaultFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  await walk(dir, dir, files);
  return files.sort();
}

async function walk(dir: string, base: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    // Skip hidden directories (except .mos) and node_modules
    if (
      entry.isDirectory() &&
      (entry.name === 'node_modules' ||
        (entry.name.startsWith('.') && entry.name !== '.mos'))
    ) {
      continue;
    }

    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(full, base, out);
    } else if (entry.isFile()) {
      const rel = relative(base, full).replaceAll(sep, '/');
      if (entry.name.endsWith('.md') || rel === '.mos/config.json') {
        out.push(rel);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

/**
 * Resolve a vault-relative request path to an absolute fs path, or return
 * null if the result escapes the vault root (path traversal guard).
 */
function safePath(reqPath: string): string | null {
  const full = resolve(join(VAULT_DIR, reqPath));
  const rel = relative(VAULT_DIR, full);
  if (rel.startsWith('..') || rel.startsWith('/')) return null;
  return full;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // ── GET /vault/files ──────────────────────────────────────────────────
    if (url.pathname === '/vault/files') {
      const files = await listVaultFiles(VAULT_DIR);
      return Response.json({ files });
    }

    // ── GET /vault/file?path=<rel> ────────────────────────────────────────
    if (url.pathname === '/vault/file') {
      const reqPath = url.searchParams.get('path');
      if (!reqPath) {
        return new Response('Missing path parameter', { status: 400 });
      }

      const full = safePath(reqPath);
      if (!full) {
        return new Response('Forbidden', { status: 403 });
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

    // ── GET /vault/watch ──────────────────────────────────────────────────
    // SSE endpoint. Keeps the connection open and broadcasts change events
    // emitted by whatever wires into `clients`. The real fs watcher is T-004;
    // here we just establish the shape the HttpVaultSource consumes.
    if (url.pathname === '/vault/watch') {
      const encoder = new TextEncoder();
      let send: ((path: string) => void) | undefined;

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          send = (path: string) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ path })}\n\n`),
            );
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
          'Connection': 'keep-alive',
        },
      });
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`[dev-server] vault: ${VAULT_DIR}`);
console.log(`[dev-server] listening on http://localhost:${PORT}`);
