/**
 * Dev filesystem server for mos (ADR-006, T-002).
 *
 * A thin Bun wrapper around the shared read-only vault endpoints in
 * @mos/vault-server (list / read / SSE watch), so the Angular dev-server can
 * proxy vault file access through them. The CLI (apps/cli, ADR-012) serves
 * the same handler in production.
 *
 * Configuration:
 *   VAULT_DIR  Path to the vault root (default: three levels up from this file,
 *              i.e. the monorepo root when running in apps/dev-server/src/).
 *   PORT       HTTP port (default: 3001).
 *
 * ADR-002: read-only — no write endpoints.
 * ADR-001: all fs access lives behind the handler; packages/core gains nothing.
 */

import { join, resolve } from 'node:path';
import { createVaultServer } from '@mos/vault-server';

const VAULT_DIR = resolve(process.env['VAULT_DIR'] ?? join(import.meta.dir, '../../..'));
const PORT = Number(process.env['PORT'] ?? '3001');

const vaultServer = createVaultServer({ vaultDir: VAULT_DIR });

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  // Bun reaps idle connections after 10s by default, which kills the SSE
  // watch stream between (sparse) change events. 0 disables the timeout;
  // the handler's heartbeat covers any other intermediary.
  idleTimeout: 0,
  fetch: (req) => vaultServer.fetch(req),
});

console.log(`[dev-server] vault: ${VAULT_DIR}`);
console.log(`[dev-server] listening on http://127.0.0.1:${PORT}`);
