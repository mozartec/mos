import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Card, FieldDef, FieldType, TypeDef } from '@mos/core';
import { IconComponent } from '../icon/icon';
import {
  IconCalendar,
  IconClock,
  IconFlag,
  IconGitCommit,
  IconHourglass,
  IconLock,
  IconUser,
} from '../../icons/tabler-icons.generated';

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
}

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './card.html',
  host: {
    '[class]': 'hostClass()',
    'tabindex': '0',
    'role': 'button',
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
    const base = 'card bg-base-100/95 border border-base-content/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out cursor-pointer block rounded-box p-3.5 focus:outline-none focus:ring-2 focus:ring-primary/40';
    const accent = this.accentClass();
    const blockedClass = this.blocked() ? 'border-error/40 shadow-error/5 bg-error/5' : '';
    return `${base} ${accent} ${blockedClass}`.trim();
  });

  protected readonly accentClass = computed(() => {
    const priority = this.card().priority;
    const type = this.card().type;

    let borderClass = 'border-l-4 border-l-base-content/25';
    if (priority === 'P0') {
      borderClass = 'border-l-4 border-l-error';
    } else if (priority === 'P1') {
      borderClass = 'border-l-4 border-l-warning';
    } else if (priority === 'P2') {
      borderClass = 'border-l-4 border-l-info';
    } else if (priority === 'P3') {
      borderClass = 'border-l-4 border-l-success';
    } else {
      if (type === 'feature') {
        borderClass = 'border-l-4 border-l-secondary';
      } else if (type === 'story') {
        borderClass = 'border-l-4 border-l-primary';
      } else if (type === 'task') {
        borderClass = 'border-l-4 border-l-accent';
      }
    }
    return borderClass;
  });

  protected readonly typeBadgeClass = computed(() => {
    const type = this.card().type;
    if (type === 'feature') return 'badge-secondary text-secondary-content';
    if (type === 'story') return 'badge-primary text-primary-content';
    return 'badge-accent text-accent-content';
  });

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

      let icon: string | undefined = undefined;
      if (key === 'owner') icon = IconUser;
      else if (key === 'sprint') icon = IconCalendar;
      else if (key === 'priority') icon = IconFlag;
      else if (key === 'estimate') icon = IconHourglass;
      else if (key === 'dependsOn') icon = IconGitCommit;
      else if (key === 'parent') icon = IconGitCommit;
      else if (key === 'created' || key === 'updated') icon = IconClock;

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
          icon,
        });
      } else if (type === 'id') {
        const listValues = Array.isArray(rawVal)
          ? rawVal.map((v) => String(v))
          : [String(rawVal)];
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
