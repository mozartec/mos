export const DEFAULT_PORT = 4400;

export const HELP = `mos — serve a markdown vault as a board and wiki (read-only)

Usage:
  mos serve [dir] [--port <n>]   Serve the vault at <dir> (default: the nearest
                                 vault at or above the current directory).
  mos --version                  Print the version.
  mos --help                     Show this help.

A vault is any folder containing .mos/config.json.`;

export interface ServeArgs {
  command: 'serve';
  dir?: string;
  port: number;
}

export type CliArgs =
  | ServeArgs
  | { command: 'help' }
  | { command: 'version' }
  | { error: string };

export function parseArgs(argv: string[]): CliArgs {
  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    return { command: 'help' };
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    return { command: 'version' };
  }
  if (argv[0] === 'serve') {
    let dir: string | undefined;
    let port = DEFAULT_PORT;
    for (let i = 1; i < argv.length; i += 1) {
      const arg = argv[i];
      if (arg === '--port') {
        const value = Number(argv[i + 1]);
        if (!Number.isInteger(value) || value < 0 || value > 65535) {
          return { error: `--port needs a number between 0 and 65535, got '${argv[i + 1] ?? ''}'` };
        }
        port = value;
        i += 1;
      } else if (arg !== undefined && arg.startsWith('-')) {
        return { error: `Unknown option '${arg}'` };
      } else if (dir === undefined) {
        dir = arg;
      } else {
        return { error: `Unexpected argument '${arg}'` };
      }
    }
    return { command: 'serve', dir, port };
  }
  return { error: `Unknown command '${argv[0]}'` };
}
