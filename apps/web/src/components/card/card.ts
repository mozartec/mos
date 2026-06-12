import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Card, FieldDef, FieldType, TypeDef } from '@mos/core';
import { IconComponent } from '../icon/icon';
import { IconLock } from '../../icons/tabler-icons.generated';
import { accentClassFor, badgeClassFor, chipClassFor, iconSvgFor } from './card-style';

interface RenderField {
  key: string;
  label: string;
  value: unknown;
  type: FieldType | 'text';
  formattedValue?: string;
  relativeTime?: string;
  absoluteTime?: string;
  isList?: boolean;
  listValues?: string[];
  icon?: string;
  chipClass?: string;
}

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './card.html',
  host: {
    '[class]': 'hostClass()',
    tabindex: '0',
    role: 'button',
    '(click)': 'onSelect()',
    '(keydown.enter)': 'onSelect()',
    '(keydown.space)': 'onSelect(); $event.preventDefault()',
  },
})
export class CardComponent {
  readonly card = input.required<Card>();
  readonly typeDef = input.required<TypeDef>();
  readonly fieldsRegistry = input.required<Record<string, FieldDef>>();
  readonly blocked = input<boolean>(false);

  readonly cardSelect = output<Card>();

  protected readonly iconLock = IconLock;

  protected readonly hostClass = computed(() => {
    // Hairlines separate, shadows mean elevation: the card earns its shadow
    // only while raised on hover (design system §Shape, §Motion). Focus comes
    // from the global focus-visible ring in styles.css.
    const base =
      'card bg-base-100 border-y border-r border-base-content/10 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 ease-out cursor-pointer block rounded-box p-3';
    const accent = this.accentClass();
    const blockedClass = this.blocked() ? 'border border-error/40 border-l-error bg-error/5' : '';
    return `${base} ${accent} ${blockedClass}`.trim();
  });

  protected readonly accentClass = computed(
    () => `border-l-4 ${accentClassFor(this.typeDef().color)}`,
  );

  protected readonly typeBadgeClass = computed(
    () => `border ${badgeClassFor(this.typeDef().color)}`,
  );

  protected readonly renderedFields = computed<RenderField[]>(() => {
    const card = this.card();
    const typeDef = this.typeDef();
    const registry = this.fieldsRegistry();
    const fieldsToRender = typeDef.card?.fields ?? [];

    const list: RenderField[] = [];
    for (const key of fieldsToRender) {
      if (key === 'id' || key === 'title') continue;

      const rawVal = card.fields[key];
      if (rawVal === undefined || rawVal === null || rawVal === '') continue;

      const fieldDef = registry[key];
      const label = fieldDef?.label || key;
      const type = fieldDef?.type || 'text';
      const icon = iconSvgFor(fieldDef?.icon);

      if (type === 'datetime' || type === 'date') {
        const timeInfo = this.formatRelativeTime(rawVal);
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
        list.push({
          key,
          label,
          value: rawVal,
          type,
          formattedValue: String(rawVal),
          chipClass: chipClassFor(fieldDef?.valueColors?.[String(rawVal)]),
          icon,
        });
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
  });

  protected onSelect(): void {
    this.cardSelect.emit(this.card());
  }

  private formatRelativeTime(value: unknown): { relative: string; absolute: string } | null {
    if (value == null) return null;
    const dateStr = String(value);
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    const now = new Date();
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
}
