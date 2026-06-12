/**
 * Load and validate a vault's `.mos/config.json`.
 *
 * Pure function — a JSON string or already-parsed object in, a typed result
 * out. No I/O, no exceptions propagated to callers (ADR-001, ADR-003). Missing
 * optional keys are filled with their documented defaults; structural problems
 * are surfaced in `errors` rather than thrown.
 */

/** A frontmatter field's declared data type (VAULT_SPEC §5a). */
export type FieldType = 'string' | 'enum' | 'id' | 'date' | 'datetime';

const KNOWN_FIELD_TYPES: readonly FieldType[] = [
  'string',
  'enum',
  'id',
  'date',
  'datetime',
];

/**
 * The curated card-color palette (VAULT_SPEC §5b). mos owns this list rather
 * than borrowing daisyUI's intent tokens (`primary`/`info`/...), so a color
 * names a fixed hue independent of theme. `loadConfig` validates against it;
 * the rendering layer maps each name to concrete styles.
 */
export const CARD_COLORS = [
  'slate',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
] as const;

/** A color name from the curated {@link CARD_COLORS} palette. */
export type CardColor = (typeof CARD_COLORS)[number];

/**
 * The curated card-icon set (VAULT_SPEC §5b). Each name is backed by a bundled
 * glyph in the rendering layer; keep this list in sync with what the app
 * bundles. `loadConfig` validates against it.
 */
export const CARD_ICONS = [
  'user',
  'calendar',
  'flag',
  'hourglass',
  'clock',
  'git-commit',
  'tag',
  'target',
  'stack',
  'bookmark',
] as const;

/** An icon name from the curated {@link CARD_ICONS} set. */
export type CardIcon = (typeof CARD_ICONS)[number];

/** A typed frontmatter field in the optional `fields` registry. */
export interface FieldDef {
  /** Data type used to render, validate, and sort the field. */
  type: FieldType;
  /** True when the frontmatter value is a YAML list of `type` (§5a), e.g. `dependsOn`. */
  list?: boolean;
  /** Display name on the card face; falls back to the field key. */
  label?: string;
  /** Allowed values for an `enum` declared inline. */
  values?: string[];
  /** Config key (e.g. `sprints`) whose list supplies an `enum`'s values. */
  source?: string;
  /** Icon glyph shown beside this field on the card face (§5b). */
  icon?: CardIcon;
  /** Per-value colors for an `enum` field: value → palette color (§5b). */
  valueColors?: Record<string, CardColor>;
}

/** A card type: its states-to-columns map, parent rule, and card-face fields. */
export interface TypeDef {
  /** Display label (e.g. `Story`). */
  label?: string;
  /** Parent type name, or `null` for a top-level type. Nesting is one level. */
  parent: string | null;
  /** Workflow state → board column (or `null` to hide from the board). */
  states: Record<string, string | null>;
  /** Fields shown on the card face, in order. */
  card?: { fields: string[] };
  /** Accent color for the card face and type badge (§5b). */
  color?: CardColor;
}

/** Which frontmatter fields the wiki reads, and which files it includes. */
export interface WikiConfig {
  include: string[];
  exclude: string[];
  fields: string[];
}

/** Board layout: which files are cards, the columns, and the sort within one. */
export interface BoardConfig {
  include: string[];
  columns: string[];
  sortWithinColumn: string[];
}

/** Reference parsing options (VAULT_SPEC §7). */
export interface ReferenceConfig {
  /** Regex source for matching card/doc ids in text. */
  idPattern: string;
}

/** Names of the two timestamp roles in frontmatter (VAULT_SPEC §4a). */
export interface TimestampConfig {
  createdField: string;
  updatedField: string;
}

/** A fully-resolved vault config: every optional key filled with its default. */
export interface VaultConfig {
  specVersion: string;
  vault: { name: string };
  meta: { timestamps: TimestampConfig };
  fields: Record<string, FieldDef>;
  wiki: WikiConfig;
  board: BoardConfig;
  references: ReferenceConfig;
  types: Record<string, TypeDef>;
  sprints: string[];
  /**
   * Vault-defined file surfaces (VAULT_SPEC §5c, ADR-021): area name → glob
   * list, e.g. `{ "web": ["apps/web/**"] }`. Cards name areas in a `touches`
   * list field; `parallelBatch` plans conflict-free work over those names.
   * Optional — `{}` means the vault doesn't plan by surface.
   */
  areas: Record<string, string[]>;
  /**
   * Canonical frontmatter property order for the write path (F-013). The app
   * reads frontmatter as a map, so order never affects rendering — agents and
   * scripts that create or update cards emit properties in this order.
   * Defaults to {@link DEFAULT_FIELD_ORDER}; unlisted properties go after the
   * listed ones, in the order they already appear.
   */
  fieldOrder: string[];
}

/** The shipped default frontmatter order, applied when `fieldOrder` is absent. */
export const DEFAULT_FIELD_ORDER: readonly string[] = [
  'id',
  'type',
  'title',
  'status',
  'priority',
  'phase',
  'owner',
  'sprint',
  'parent',
  'estimate',
  'dependsOn',
  'touches',
  'created',
  'updated',
];

/** Result of {@link loadConfig}: the resolved config plus any diagnostics. */
export interface LoadConfigResult {
  config: VaultConfig;
  errors: string[];
}

const DEFAULT_ID_PATTERN = '[A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*';

/**
 * Parse, default, and validate a vault config. Never throws.
 *
 * @param input  The config as a JSON string or an already-parsed object.
 *               Never a path — reading the file is the caller's job (ADR-001).
 */
export function loadConfig(input: string | object): LoadConfigResult {
  const errors: string[] = [];

  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      errors.push(
        `config: invalid JSON — ${e instanceof Error ? e.message : 'parse error'}`,
      );
      return { config: defaultConfig(), errors };
    }
  }

  if (!isObject(raw)) {
    errors.push('config: expected a JSON object');
    return { config: defaultConfig(), errors };
  }

  const config = normalize(raw);
  validate(config, errors);
  return { config, errors };
}

/** A minimal, well-shaped config used when input is unusable. */
function defaultConfig(): VaultConfig {
  return {
    specVersion: '',
    vault: { name: '' },
    meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
    fields: {},
    wiki: { include: [], exclude: [], fields: [] },
    board: { include: [], columns: [], sortWithinColumn: ['priority', 'id'] },
    references: { idPattern: DEFAULT_ID_PATTERN },
    types: {},
    sprints: [],
    areas: {},
    fieldOrder: [...DEFAULT_FIELD_ORDER],
  };
}

/** Fill every optional key with its documented default. */
function normalize(obj: Record<string, unknown>): VaultConfig {
  const vault = isObject(obj['vault']) ? obj['vault'] : {};
  const meta = isObject(obj['meta']) ? obj['meta'] : {};
  const timestamps = isObject(meta['timestamps']) ? meta['timestamps'] : {};
  const wiki = isObject(obj['wiki']) ? obj['wiki'] : {};
  const board = isObject(obj['board']) ? obj['board'] : {};
  const references = isObject(obj['references']) ? obj['references'] : {};

  return {
    specVersion: typeof obj['specVersion'] === 'string' ? obj['specVersion'] : '',
    vault: { name: typeof vault['name'] === 'string' ? vault['name'] : '' },
    meta: {
      timestamps: {
        createdField: asString(timestamps['createdField'], 'created'),
        updatedField: asString(timestamps['updatedField'], 'updated'),
      },
    },
    fields: isObject(obj['fields']) ? (obj['fields'] as Record<string, FieldDef>) : {},
    wiki: {
      include: asStringArray(wiki['include']),
      exclude: asStringArray(wiki['exclude']),
      fields: asStringArray(wiki['fields']),
    },
    board: {
      include: asStringArray(board['include']),
      columns: asStringArray(board['columns']),
      sortWithinColumn:
        board['sortWithinColumn'] === undefined
          ? ['priority', 'id']
          : asStringArray(board['sortWithinColumn']),
    },
    references: {
      idPattern: asString(references['idPattern'], DEFAULT_ID_PATTERN),
    },
    types: isObject(obj['types']) ? (obj['types'] as Record<string, TypeDef>) : {},
    sprints: asStringArray(obj['sprints']),
    areas: isObject(obj['areas']) ? (obj['areas'] as Record<string, string[]>) : {},
    fieldOrder:
      obj['fieldOrder'] === undefined ? [...DEFAULT_FIELD_ORDER] : asStringArray(obj['fieldOrder']),
  };
}

/**
 * Return a new frontmatter map with keys in the configured canonical order
 * (F-013). Keys not in `order` follow the listed ones, keeping their relative
 * order. A write-path utility: the read path never depends on key order.
 */
export function orderFrontmatter(
  data: Record<string, unknown>,
  order: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of order) {
    if (key in data) result[key] = data[key];
  }
  for (const key of Object.keys(data)) {
    if (!(key in result)) result[key] = data[key];
  }
  return result;
}

/**
 * Validate structure generically (never special-casing this vault's type
 * names): parent nesting ≤ 1, every state maps to a real column or `null`, and
 * every registered field has a known type with a usable `enum` source.
 */
function validate(config: VaultConfig, errors: string[]): void {
  try {
    // Validate user-provided regex source once up-front.
    new RegExp(config.references.idPattern, 'g');
  } catch (e) {
    errors.push(
      `references.idPattern: invalid regex — ${e instanceof Error ? e.message : 'parse error'}`,
    );
  }

  const columns = config.board.columns;
  const types = config.types as Record<string, unknown>;

  for (const [typeName, typeRaw] of Object.entries(types)) {
    const type = isObject(typeRaw) ? typeRaw : {};

    const parent = type['parent'];
    if (parent != null) {
      // hasOwn, not `in`: a parent like 'constructor' must not resolve via
      // the prototype chain of a plain JSON object.
      if (typeof parent !== 'string' || !Object.hasOwn(types, parent)) {
        errors.push(
          `type ${typeName}: parent type '${String(parent)}' is not defined`,
        );
      } else {
        const parentDef = types[parent];
        if (isObject(parentDef) && parentDef['parent'] != null) {
          errors.push(
            `type ${typeName}: parent '${parent}' itself has a parent (nesting > 1)`,
          );
        }
      }
    }

    const states = isObject(type['states']) ? type['states'] : {};
    for (const [state, col] of Object.entries(states)) {
      if (col != null && (typeof col !== 'string' || !columns.includes(col))) {
        errors.push(
          `type ${typeName}: state '${state}' maps to unknown column '${String(col)}'`,
        );
      }
    }

    const color = type['color'];
    if (
      color != null &&
      !(CARD_COLORS as readonly string[]).includes(color as string)
    ) {
      errors.push(`type ${typeName}: unknown color '${String(color)}'`);
    }
  }

  const fields = config.fields as Record<string, unknown>;
  for (const [fieldName, fieldRaw] of Object.entries(fields)) {
    const field = isObject(fieldRaw) ? fieldRaw : {};
    const fieldType = field['type'];
    if (
      typeof fieldType !== 'string' ||
      !KNOWN_FIELD_TYPES.includes(fieldType as FieldType)
    ) {
      errors.push(`field ${fieldName}: unknown type '${String(fieldType)}'`);
      continue;
    }
    const icon = field['icon'];
    if (
      icon != null &&
      !(CARD_ICONS as readonly string[]).includes(icon as string)
    ) {
      errors.push(`field ${fieldName}: unknown icon '${String(icon)}'`);
    }
    const list = field['list'];
    if (list !== undefined && typeof list !== 'boolean') {
      errors.push(`field ${fieldName}: 'list' must be a boolean`);
    }
    const valueColors = field['valueColors'];
    if (valueColors != null) {
      if (!isObject(valueColors)) {
        errors.push(`field ${fieldName}: valueColors must be an object`);
      } else {
        for (const [val, c] of Object.entries(valueColors)) {
          if (!(CARD_COLORS as readonly string[]).includes(c as string)) {
            errors.push(
              `field ${fieldName}: value '${val}' has unknown color '${String(c)}'`,
            );
          }
        }
      }
    }
    if (fieldType === 'enum') {
      const hasValues = Array.isArray(field['values']) && (field['values'] as unknown[]).length > 0;
      if (hasValues) continue;
      const source = field['source'];
      // A source resolves to a config list (its entries are the values, e.g.
      // `sprints`) or a config map (its keys are the values, e.g. `areas`).
      // Own keys only: '__proto__' or 'constructor' must not resolve.
      const resolved =
        typeof source === 'string' && Object.hasOwn(config, source)
          ? (config as unknown as Record<string, unknown>)[source]
          : undefined;
      if (source === undefined) {
        errors.push(`field ${fieldName}: enum needs 'values' or 'source'`);
      } else if (!Array.isArray(resolved) && !isObject(resolved)) {
        errors.push(
          `field ${fieldName}: enum source '${String(source)}' does not resolve to a config list or map`,
        );
      }
    }
  }

  for (const [areaName, globs] of Object.entries(config.areas)) {
    if (!Array.isArray(globs) || globs.some((g) => typeof g !== 'string')) {
      errors.push(`area ${areaName}: expected a list of glob strings`);
    }
  }
}

/** A non-null, non-array object. */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The string `v`, or `fallback` when `v` is not a string. */
function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

/** `v` as a string array, dropping non-string members; `[]` if not an array. */
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
