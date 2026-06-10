import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Serve the bundled web app: real files by path, and the SPA's index.html for
 * extensionless routes (/board, /wiki, …) so deep links work.
 */
export async function serveStatic(webRoot: string, pathname: string): Promise<Response> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const full = resolve(join(webRoot, decoded));
  const rel = relative(webRoot, full);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    return new Response('Forbidden', { status: 403 });
  }

  // Extensionless paths are SPA routes — serve the app shell.
  const candidate = extname(full) ? full : join(webRoot, 'index.html');
  try {
    const content = await readFile(candidate);
    const type = MIME[extname(candidate).toLowerCase()] ?? 'application/octet-stream';
    return new Response(new Uint8Array(content), { headers: { 'Content-Type': type } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
