import { describe, expect, it } from 'bun:test';
import { DEFAULT_PORT, parseArgs } from './args';

describe('parseArgs', () => {
  it('defaults to help with no arguments', () => {
    expect(parseArgs([])).toEqual({ command: 'help' });
    expect(parseArgs(['--help'])).toEqual({ command: 'help' });
  });

  it('parses serve with optional dir and port', () => {
    expect(parseArgs(['serve'])).toEqual({ command: 'serve', dir: undefined, port: DEFAULT_PORT });
    expect(parseArgs(['serve', '../erp', '--port', '5050'])).toEqual({
      command: 'serve',
      dir: '../erp',
      port: 5050,
    });
  });

  it('rejects bad ports, unknown options, and unknown commands', () => {
    expect(parseArgs(['serve', '--port', 'abc'])).toHaveProperty('error');
    expect(parseArgs(['serve', '--write'])).toHaveProperty('error');
    expect(parseArgs(['deploy'])).toHaveProperty('error');
  });
});
