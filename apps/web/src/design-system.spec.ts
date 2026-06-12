import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Guards the Ink & Highlight design system (docs/13-DESIGN_SYSTEM.md, ADR-016)
 * at the stylesheet level:
 *
 * - the `dark:` variant is re-keyed to `data-theme='mos-carbon'` (the toggle),
 *   not the OS `prefers-color-scheme` — so the curated card-color ramp follows
 *   the in-app theme even when it disagrees with the OS;
 * - `mos-paper`/`mos-carbon` are the only registered themes and stay
 *   token-identical to the design doc;
 * - every text-bearing token pair meets WCAG AA (4.5:1), computed from the
 *   oklch values, in both themes;
 * - raw Tailwind palette classes appear nowhere outside the sanctioned
 *   card-color ramp in card-style.ts.
 */

/** Resolve a repo-root-relative path by walking up from the test runner's cwd. */
function repoFile(relativePath: string): string {
  let dir = process.cwd();
  for (;;) {
    const candidate = resolve(dir, relativePath);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`not found upward from cwd: ${relativePath}`);
    dir = parent;
  }
}

const stylesCss = readFileSync(repoFile('apps/web/src/styles.css'), 'utf8');
const designDoc = readFileSync(repoFile('docs/13-DESIGN_SYSTEM.md'), 'utf8');

/**
 * Every `@plugin 'daisyui/theme' { … }` block in a stylesheet, keyed by name.
 * Tolerant of formatter churn: comments are stripped first, quotes may be
 * single or double, whitespace is free-form.
 */
function themeBlocks(source: string): Record<string, string> {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: Record<string, string> = {};
  const re = /@plugin\s+['"]daisyui\/theme['"]\s*\{([^}]*)\}/g;
  for (const match of noComments.matchAll(re)) {
    const body = match[1];
    const name = /name:\s*['"]([^'"]+)['"]/.exec(body)?.[1];
    if (name) blocks[name] = body;
  }
  return blocks;
}

/** The `--color-*` declarations of a theme block, keyed by token name. */
function colorTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

describe('dark: variant re-key (ADR-016)', () => {
  it('keys dark: on data-theme=mos-carbon, not the OS scheme', () => {
    const line = stylesCss.split('\n').find((l) => l.includes('@custom-variant dark'));
    expect(line).toBeDefined();
    expect(line).toMatch(/\[data-theme=['"]mos-carbon['"]\]/);
    expect(line).not.toContain('prefers-color-scheme');
  });

  it('declares the variant exactly once', () => {
    expect(stylesCss.match(/@custom-variant dark/g)).toHaveLength(1);
  });
});

describe('theme registration', () => {
  it('disables the daisyUI built-in themes', () => {
    expect(stylesCss).toMatch(/@plugin\s+['"]daisyui['"]\s*\{\s*themes:\s*false;?\s*\}/);
  });

  it('registers exactly mos-paper and mos-carbon', () => {
    expect(Object.keys(themeBlocks(stylesCss)).sort()).toEqual(['mos-carbon', 'mos-paper']);
  });

  it('makes mos-paper the default and mos-carbon the OS-dark pick', () => {
    const blocks = themeBlocks(stylesCss);
    expect(blocks['mos-paper']).toMatch(/default:\s*true/);
    expect(blocks['mos-paper']).toMatch(/color-scheme:\s*['"]?light/);
    expect(blocks['mos-carbon']).toMatch(/prefersdark:\s*true/);
    expect(blocks['mos-carbon']).toMatch(/color-scheme:\s*['"]?dark/);
  });

  it('stays token-identical to docs/13-DESIGN_SYSTEM.md', () => {
    const app = themeBlocks(stylesCss);
    const doc = themeBlocks(designDoc);
    for (const name of ['mos-paper', 'mos-carbon']) {
      expect(doc[name], `design doc must spec ${name}`).toBeDefined();
      expect(colorTokens(app[name]), `${name} tokens must match the design doc`).toEqual(
        colorTokens(doc[name]),
      );
    }
  });
});

describe('WCAG AA contrast of the theme tokens', () => {
  function oklchToSrgb(L: number, C: number, hDeg: number): [number, number, number] {
    const h = (hDeg * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const toGamma = (c: number) => {
      const clamped = Math.min(1, Math.max(0, c));
      return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    };
    return [
      toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ];
  }

  function luminance([r, g, b]: [number, number, number]): number {
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function parseOklch(value: string): [number, number, number] {
    const match = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)/.exec(value);
    if (!match) throw new Error(`not an oklch literal: ${value}`);
    return [Number(match[1]) / 100, Number(match[2]), Number(match[3])];
  }

  function contrast(fg: string, bg: string): number {
    const l1 = luminance(oklchToSrgb(...parseOklch(fg)));
    const l2 = luminance(oklchToSrgb(...parseOklch(bg)));
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  }

  // Pairs that carry normal-size text somewhere in the app (AA: 4.5:1).
  const textPairs: [string, string][] = [
    ['base-content', 'base-100'],
    ['base-content', 'base-200'],
    ['base-content', 'base-300'],
    ['primary-content', 'primary'],
    ['secondary-content', 'secondary'],
    ['accent-content', 'accent'],
    ['neutral-content', 'neutral'],
    ['info-content', 'info'],
    ['success-content', 'success'],
    ['warning-content', 'warning'],
    ['error-content', 'error'],
    // status colors also appear as text on the page (text-error, link color)
    ['error', 'base-100'],
    ['info', 'base-100'],
    ['success', 'base-100'],
  ];

  for (const theme of ['mos-paper', 'mos-carbon']) {
    describe(theme, () => {
      const tokens = colorTokens(themeBlocks(stylesCss)[theme]);
      for (const [fg, bg] of textPairs) {
        it(`${fg} on ${bg} is at least 4.5:1`, () => {
          expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }
});

describe('semantic tokens only (ADR-016)', () => {
  // The curated card-color ramp is the one sanctioned use of raw Tailwind
  // palette classes; specs may quote them to test that mapping. Everything
  // else must go through daisyUI semantic tokens.
  const RAW_PALETTE =
    /\b(?:bg|text|border|border-[lrtbxy]|from|via|to|ring|outline|fill|stroke|decoration|divide|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+(?:\/\d+)?/g;

  it('keeps raw Tailwind palette classes out of everything but card-style.ts', () => {
    const srcDir = repoFile('apps/web/src');
    const offenders: string[] = [];
    for (const entry of readdirSync(srcDir, { recursive: true }) as string[]) {
      if (!/\.(ts|html|css)$/.test(entry)) continue;
      if (entry.endsWith('card-style.ts') || entry.endsWith('.spec.ts')) continue;
      const content = readFileSync(join(srcDir, entry), 'utf8');
      for (const match of content.matchAll(RAW_PALETTE)) {
        offenders.push(`${entry}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
