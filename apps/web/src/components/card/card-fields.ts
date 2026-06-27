import type { Card, FieldDef, FieldType, TypeDef } from '@mos/core';
import { chipClassFor, iconSvgFor } from './card-style';

/**
 * One rendered frontmatter field for a card face: the value resolved to its
 * display form (relative time, enum chips, mono ids, plain text) per the field's
 * declared type. Built from config alone — nothing about a field's presentation
 * is hardcoded (ADR-003). Shared by the board {@link CardComponent} and the
 * card-page detail header so both render the type's configured fields the same
 * way (F-021-S-02).
 */
export interface RenderField {
  key: string;
  label: string;
  value: unknown;
  type: FieldType | 'text';
  formattedValue?: string;
  relativeTime?: string;
  absoluteTime?: string;
  isList?: boolean;
  listValues?: string[];
  /** Per-entry chips for a list `enum` field: each value with its own color. */
  listChips?: { value: string; chipClass: string }[];
  icon?: string;
  chipClass?: string;
}

/**
 * Project a card's configured `card.fields` (from its type) into a list of
 * {@link RenderField}s, in the configured order. `id` and `title` are skipped
 * (they head the card/header separately), as are empty values. Pure: the card,
 * its type, the field registry, and a `now` for relative-time formatting in,
 * render rows out — no I/O, no globals (ADR-001 spirit), so it is unit-testable
 * and reused unchanged by the detail header.
 */
export function buildRenderFields(
  card: Card,
  typeDef: TypeDef,
  registry: Record<string, FieldDef>,
  now: Date = new Date(),
): RenderField[] {
  const fieldsToRender = typeDef.card?.fields ?? [];

  const list: RenderField[] = [];
  for (const key of fieldsToRender) {
    if (key === 'id' || key === 'title') continue;

    const rawVal = card.fields[key];
    if (rawVal === undefined || rawVal === null || rawVal === '') continue;
    if (Array.isArray(rawVal) && rawVal.length === 0) continue;

    const fieldDef = registry[key];
    const label = fieldDef?.label || key;
    const type = fieldDef?.type || 'text';
    const icon = iconSvgFor(fieldDef?.icon);

    if (type === 'datetime' || type === 'date') {
      const timeInfo = formatRelativeTime(rawVal, now);
      if (!timeInfo) continue;
      list.push({
        key,
        label,
        value: rawVal,
        type,
        relativeTime: timeInfo.relative,
        absoluteTime: timeInfo.absolute,
        icon,
      });
    } else if (type === 'enum') {
      if (fieldDef?.list === true || Array.isArray(rawVal)) {
        // Dedup after stringifying: duplicate entries would render twice
        // and collide as @for track keys.
        const entries = [
          ...new Set((Array.isArray(rawVal) ? rawVal : [rawVal]).map((v) => String(v))),
        ];
        list.push({
          key,
          label,
          value: rawVal,
          type,
          isList: true,
          listChips: entries.map((value) => ({
            value,
            chipClass: chipClassFor(fieldDef?.valueColors?.[value]),
          })),
          icon,
        });
      } else {
        list.push({
          key,
          label,
          value: rawVal,
          type,
          formattedValue: String(rawVal),
          chipClass: chipClassFor(fieldDef?.valueColors?.[String(rawVal)]),
          icon,
        });
      }
    } else if (type === 'id') {
      const listValues = Array.isArray(rawVal) ? rawVal.map((v) => String(v)) : [String(rawVal)];
      list.push({
        key,
        label,
        value: rawVal,
        type,
        isList: true,
        listValues,
        icon,
      });
    } else {
      list.push({
        key,
        label,
        value: rawVal,
        type: 'text',
        formattedValue: String(rawVal),
        icon,
      });
    }
  }
  return list;
}

/** Format a timestamp as a relative label plus its ISO absolute (for a title). */
function formatRelativeTime(
  value: unknown,
  now: Date,
): { relative: string; absolute: string } | null {
  if (value == null) return null;
  const dateStr = String(value);
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 0) {
    return { relative: 'in the future', absolute: date.toISOString() };
  }
  if (diffSecs < 60) {
    return { relative: 'just now', absolute: date.toISOString() };
  }
  if (diffMins < 60) {
    return { relative: `${diffMins}m ago`, absolute: date.toISOString() };
  }
  if (diffHours < 24) {
    return { relative: `${diffHours}h ago`, absolute: date.toISOString() };
  }
  if (diffDays < 30) {
    return { relative: `${diffDays}d ago`, absolute: date.toISOString() };
  }

  return {
    relative: date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    absolute: date.toISOString(),
  };
}
