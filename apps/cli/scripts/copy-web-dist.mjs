// Copy the built web app into the CLI's dist so the published package serves
// it as static assets (ADR-012). Runs after `bun build` in this package's
// build script; turbo's ^build ordering guarantees @mos/web built first.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webDist = join(here, '../../web/dist/@mos/web');
const webBrowserDist = join(webDist, 'browser');
const target = join(here, '../dist/web');

if (!existsSync(webBrowserDist)) {
  console.error(
    `[copy-web-dist] missing web build at ${webBrowserDist} — run the @mos/web build first.`,
  );
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(webBrowserDist, target, { recursive: true });

// Third-party license attributions are emitted next to browser/, not inside
// it — ship them with the package (T-008).
const licenses = join(webDist, '3rdpartylicenses.txt');
if (!existsSync(licenses)) {
  console.error('[copy-web-dist] missing 3rdpartylicenses.txt in the web build.');
  process.exit(1);
}
cpSync(licenses, join(target, '3rdpartylicenses.txt'));

console.log(`[copy-web-dist] bundled web app → ${target}`);
