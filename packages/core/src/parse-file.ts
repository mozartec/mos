/**
 * Parse a single markdown file into its YAML frontmatter and body.
 *
 * Pure function — a string in, a typed result out. No I/O, no exceptions
 * propagated to callers (ADR-001). Parse failures are surfaced in `errors`.
 */

import { parseDocument } from 'yaml';

/** Result of parsing a single markdown file. */
export interface ParsedFile {
  /** Vault-relative path of the source file. */
  path: string;
  /** Frontmatter key/value pairs, or `{}` if none present or unparseable. */
  data: Record<string, unknown>;
  /**
   * Raw markdown body — everything after the closing frontmatter fence.
   * Returned verbatim: no trimming or rewriting (ADR-002 discipline applies
   * even to the parser).
   */
  body: string;
  /** Non-fatal parse errors (e.g. malformed YAML lines). Empty on success. */
  errors: string[];
}

/**
 * Match a leading frontmatter block: `---` on its own first line, the YAML
 * payload (captured, possibly empty), then a closing `---` line. Trailing
 * spaces/tabs on either fence are tolerated; CRLF and LF both work; the
 * closing fence may end the file with or without a trailing newline.
 *
 * Frontmatter is only recognised at the very first byte — neither a BOM nor
 * leading whitespace may precede the opening fence.
 */
const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/;

/**
 * Split `text` into YAML frontmatter and body, parse the frontmatter into a
 * plain object, and return a {@link ParsedFile}. Never throws.
 *
 * @param path  Vault-relative path stored verbatim in the result; not read.
 * @param text  Raw file contents as a string.
 */
export function parseFile(path: string, text: string): ParsedFile {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) {
    // No well-formed frontmatter block (none, or an unclosed opening fence) —
    // the whole file is body.
    return { path, data: {}, body: text, errors: [] };
  }

  const frontmatterText = match[1];
  const body = text.slice(match[0].length);

  const errors: string[] = [];
  const data = parseFrontmatter(frontmatterText, errors);

  return { path, data, body, errors };
}

/**
 * Parse a frontmatter YAML block into a plain object using the `yaml` package.
 *
 * Honors the no-throw contract: syntax errors are collected into `errors` and
 * yield `{}` rather than propagating. A block that parses to something other
 * than a mapping (a bare scalar or a sequence) is reported as an error too —
 * frontmatter must be key/value pairs.
 */
function parseFrontmatter(yamlText: string, errors: string[]): Record<string, unknown> {
  try {
    const doc = parseDocument(yamlText);
    if (doc.errors.length > 0) {
      for (const err of doc.errors) {
        errors.push(`yaml: ${err.message.split('\n')[0]}`);
      }
      return {};
    }

    const value: unknown = doc.toJS();
    if (value == null) return {}; // empty frontmatter block
    if (typeof value !== 'object' || Array.isArray(value)) {
      errors.push('yaml: frontmatter is not a mapping');
      return {};
    }
    return value as Record<string, unknown>;
  } catch (e) {
    errors.push(`yaml: ${e instanceof Error ? e.message : 'unexpected parse error'}`);
    return {};
  }
}
