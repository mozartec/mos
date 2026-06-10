/**
 * The `mos` CLI (F-015, ADR-012). Bundled to plain Node-compatible JS; the
 * built web app rides along in dist/web. Read-only over the vault (ADR-002).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELP, parseArgs } from './args';
import { findVault } from './find-vault';
import { startServer } from './serve';

const here = dirname(fileURLToPath(import.meta.url));

const args = parseArgs(process.argv.slice(2));

if ('error' in args) {
  console.error(`mos: ${args.error}\n`);
  console.error(HELP);
  process.exit(2);
}

if (args.command === 'help') {
  console.log(HELP);
} else if (args.command === 'version') {
  // package.json sits one level above both src/ (dev) and dist/ (published).
  const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf-8')) as {
    version: string;
  };
  console.log(pkg.version);
} else if (args.command === 'serve') {
  const start = resolve(args.dir ?? process.cwd());
  const vaultDir = findVault(start);
  if (!vaultDir) {
    console.error(
      `Not a mos vault: no .mos/config.json found at or above '${start}'.\n` +
        'Run `mos serve` inside a vault, or pass the vault folder: mos serve <dir>',
    );
    process.exit(1);
  }
  const webRoot = join(here, 'web');
  const { port } = await startServer({ vaultDir, webRoot, port: args.port });
  console.log(`[mos] vault: ${vaultDir}`);
  console.log(`[mos] board + wiki at http://127.0.0.1:${port}`);
}
