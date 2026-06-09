import type { CardColor, CardIcon } from '@mos/core';
import {
  IconBookmark,
  IconCalendar,
  IconClock,
  IconFlag,
  IconGitCommit,
  IconHourglass,
  IconStack,
  IconTag,
  IconTarget,
  IconUser,
} from '../../icons/tabler-icons.generated';

/**
 * Concrete styles for each curated card color (VAULT_SPEC §5b). The mapping
 * lives here, in the rendering layer — pure `@mos/core` only owns the names.
 *
 * Each class string is written out in full rather than built from a template
 * (`border-l-${c}-500`) on purpose: Tailwind's compiler only keeps classes it
 * can see literally in source, so dynamic strings would be purged and silently
 * render unstyled.
 */
interface ColorClasses {
  /** Left accent border on the card. */
  accent: string;
  /** Type badge background/text/border. */
  badge: string;
  /** Enum-value chip background/text. */
  chip: string;
}

const COLOR_CLASSES: Record<CardColor, ColorClasses> = {
  slate: {
    accent: 'border-l-slate-500',
    badge:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700/50',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  },
  red: {
    accent: 'border-l-red-500',
    badge:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50',
    chip: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  },
  orange: {
    accent: 'border-l-orange-500',
    badge:
      'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50',
    chip: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  },
  amber: {
    accent: 'border-l-amber-500',
    badge:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
  green: {
    accent: 'border-l-green-500',
    badge:
      'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/50',
    chip: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  },
  teal: {
    accent: 'border-l-teal-500',
    badge:
      'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/50',
    chip: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
  },
  blue: {
    accent: 'border-l-blue-500',
    badge:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  },
  indigo: {
    accent: 'border-l-indigo-500',
    badge:
      'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50',
    chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  purple: {
    accent: 'border-l-purple-500',
    badge:
      'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50',
    chip: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  },
  pink: {
    accent: 'border-l-pink-500',
    badge:
      'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800/50',
    chip: 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300',
  },
};

/** Default styling when a type/value declares no color. */
const DEFAULT_ACCENT = 'border-l-base-content/25';
const DEFAULT_BADGE = 'bg-base-200 text-base-content/70 border-base-content/10';
const DEFAULT_CHIP = 'bg-base-200 text-base-content/70';

/** Left accent border class for a card color, or a neutral default. */
export function accentClassFor(color: CardColor | undefined): string {
  return color ? COLOR_CLASSES[color].accent : DEFAULT_ACCENT;
}

/** Type badge classes for a card color, or a neutral default. */
export function badgeClassFor(color: CardColor | undefined): string {
  return color ? COLOR_CLASSES[color].badge : DEFAULT_BADGE;
}

/** Enum-value chip classes for a card color, or a neutral default. */
export function chipClassFor(color: CardColor | undefined): string {
  return color ? COLOR_CLASSES[color].chip : DEFAULT_CHIP;
}

/** The bundled SVG for each curated icon name (VAULT_SPEC §5b). */
const ICON_SVG: Record<CardIcon, string> = {
  user: IconUser,
  calendar: IconCalendar,
  flag: IconFlag,
  hourglass: IconHourglass,
  clock: IconClock,
  'git-commit': IconGitCommit,
  tag: IconTag,
  target: IconTarget,
  stack: IconStack,
  bookmark: IconBookmark,
};

/** The bundled SVG for an icon name, or `undefined` if not in the curated set. */
export function iconSvgFor(name: CardIcon | undefined): string | undefined {
  return name ? ICON_SVG[name] : undefined;
}
