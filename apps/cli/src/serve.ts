import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { createVaultServer, type VaultServer } from '@mos/vault-server';
import { serveStatic } from './static-files';

export interface ServeOptions {
  vaultDir: string;
  webRoot: string;
  port: number;
  host?: string;
}

export interface RunningServer {
  server: Server;
  vault: VaultServer;
  /** The port actually bound (useful when 0 was requested). */
  port: number;
  close(): Promise<void>;
}

/**
 * One Node process serving both surfaces, same origin (ADR-012):
 *   /vault/*    the shared read-only vault endpoints (@mos/vault-server)
 *   everything  the bundled web app, with SPA fallback
 */
export async function startServer({
  vaultDir,
  webRoot,
  port,
  host = '127.0.0.1',
}: ServeOptions): Promise<RunningServer> {
  const vault = createVaultServer({ vaultDir });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', `http://${host}`);
      let response: Response;
      if (url.pathname === '/vault' || url.pathname.startsWith('/vault/')) {
        response = await vault.fetch(new Request(url.toString(), { method: req.method }));
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        response = await serveStatic(webRoot, url.pathname);
      } else {
        response = new Response('Method not allowed (read-only server)', { status: 405 });
      }

      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (!response.body || req.method === 'HEAD') {
        res.end();
        return;
      }
      const body = Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>);
      // When the client disconnects (e.g. an SSE watcher tab closes), tear the
      // source stream down so the handler drops the subscription.
      res.on('close', () => body.destroy());
      body.pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end('Internal error');
    }
  }

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolveListen());
  });

  return {
    server,
    vault,
    port: (server.address() as AddressInfo).port,
    close: async () => {
      await vault.close();
      await new Promise<void>((resolveClose) => {
        server.close(() => resolveClose());
        server.closeAllConnections();
      });
    },
  };
}
