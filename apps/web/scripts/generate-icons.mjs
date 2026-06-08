// @ts-check
/**
 * Generate a typed, tree-shakeable Tabler icon module from the official
 * `@tabler/icons` package (devDependency, used at build time only).
 *
 * Why generate instead of importing a package?
 *  - `@tabler/icons` ships only raw SVG files, not JS exports — nothing
 *    tree-shakeable to import.
 *  - The webfont (`@tabler/icons-webfont`) ships ALL ~5,900 icons (~3 MB).
 *  - The community Angular bridge (`angular-tabler-icons`) is the right pattern
 *    but pins `@angular/core: "17 - 19"` and is unmaintained.
 *
 * So we reproduce the bridge's proven output ourselves: each icon becomes a
 * `string` const holding its `<svg>` markup, sourced verbatim from the package.
 * Only the icons listed in ICONS reach the bundle. This file is the seed of a
 * future first-party `@mos/icons` package.
 *
 * Usage: `bun run icons:generate` (from apps/web). Re-run after adding a name
 * to ICONS or bumping `@tabler/icons`. The output is committed.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/**
 * Icons to bundle, as Tabler `outline` names (https://tabler.io/icons).
 * Add a name here, re-run, and commit the regenerated file.
 */
const ICONS = ['sun', 'moon'];

/** Resolve the installed @tabler/icons package root via its `exports` map. */
function tablerIconsRoot() {
  // The package only exports `./*` → `./icons/*`, so package.json isn't
  // reachable directly; resolve a real icon and walk up to the package root.
  const anIcon = require.resolve('@tabler/icons/outline/sun.svg');
  // .../@tabler/icons/icons/outline/sun.svg → .../@tabler/icons
  return dirname(dirname(dirname(anIcon)));
}

/**
 * Read a Tabler outline SVG and normalize it for inline rendering:
 * strip the intrinsic width/height (the component controls size) and the
 * library `class`, keeping the stroke/fill/viewBox attributes intact.
 * @param {string} root @tabler/icons package root
 * @param {string} name outline icon name
 */
function readIconSvg(root, name) {
  const file = join(root, 'icons', 'outline', `${name}.svg`);
  let svg = readFileSync(file, 'utf8').trim();
  svg = svg
    .replace(/\s+width="[^"]*"/, '')
    .replace(/\s+height="[^"]*"/, '')
    .replace(/\s+class="[^"]*"/, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
  return svg;
}

/** Convert a kebab-case icon name to an `Icon`-prefixed PascalCase const id. */
function constName(name) {
  const pascal = name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `Icon${pascal}`;
}

function main() {
  const root = tablerIconsRoot();
  const version = JSON.parse(
    readFileSync(join(root, 'package.json'), 'utf8'),
  ).version;

  const header = `// AUTO-GENERATED — do not edit by hand.
// Source: @tabler/icons v${version} (outline). Regenerate: \`bun run icons:generate\`.
// Each export is a tree-shakeable SVG string; only imported icons are bundled.

/** A Tabler icon as inline SVG markup. Pass to <app-icon [icon]="...">. */
export type TablerIcon = string;
`;

  const body = ICONS.map((name) => {
    const svg = readIconSvg(root, name).replace(/`/g, '\\`');
    return `\nexport const ${constName(name)}: TablerIcon =\n  \`${svg}\`;`;
  }).join('\n');

  const out = join(here, '..', 'src', 'icons', 'tabler-icons.generated.ts');
  writeFileSync(out, header + body + '\n', 'utf8');
  console.log(`Generated ${ICONS.length} icon(s) → ${out}`);
}

main();
