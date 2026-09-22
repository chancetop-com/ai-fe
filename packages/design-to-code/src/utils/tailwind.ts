import type { Box, Layout } from '../types/ir';

const GAP_MAP: Record<number, string> = {
  0: 'gap-0',
  4: 'gap-1',
  8: 'gap-2',
  12: 'gap-3',
  16: 'gap-4',
  20: 'gap-5',
  24: 'gap-6',
  32: 'gap-8',
  40: 'gap-10',
  48: 'gap-12',
};

const PADDING_MAP: Record<number, string> = {
  0: '0',
  4: '1',
  8: '2',
  12: '3',
  16: '4',
  20: '5',
  24: '6',
  32: '8',
  40: '10',
  48: '12',
};

function nearestKey(map: Record<number, string>, value: number): string | undefined {
  if (map[value]) return map[value];
  const keys = Object.keys(map).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) return undefined;
  let closest = keys[0]!;
  for (const k of keys) {
    if (Math.abs(k - value) < Math.abs(closest - value)) closest = k;
  }
  return map[closest];
}

function scaleOf(value: number): string | undefined {
  if (value === 0) return '0';
  return nearestKey(PADDING_MAP, value);
}

/** Convert padding box to Tailwind utilities (p- / px- / py- / pt- …). */
export function paddingToTailwind(padding?: Box): string {
  if (!padding) return '';
  return paddingClasses(padding).join(' ');
}

function paddingClasses(padding: Box): string[] {
  const { top, right, bottom, left } = padding;
  if (top === right && right === bottom && bottom === left) {
    if (top === 0) return [];
    const scale = scaleOf(top);
    return scale ? [`p-${scale}`] : [];
  }
  if (top === bottom && left === right) {
    const classes: string[] = [];
    if (top) {
      const y = scaleOf(top);
      if (y) classes.push(`py-${y}`);
    }
    if (left) {
      const x = scaleOf(left);
      if (x) classes.push(`px-${x}`);
    }
    return classes;
  }
  const classes: string[] = [];
  if (top) {
    const s = scaleOf(top);
    if (s) classes.push(`pt-${s}`);
  }
  if (right) {
    const s = scaleOf(right);
    if (s) classes.push(`pr-${s}`);
  }
  if (bottom) {
    const s = scaleOf(bottom);
    if (s) classes.push(`pb-${s}`);
  }
  if (left) {
    const s = scaleOf(left);
    if (s) classes.push(`pl-${s}`);
  }
  return classes;
}

const ALIGN_MAP: Record<string, string> = {
  MIN: 'items-start',
  CENTER: 'items-center',
  MAX: 'items-end',
  BASELINE: 'items-baseline',
  STRETCH: 'items-stretch',
};

const JUSTIFY_MAP: Record<string, string> = {
  MIN: 'justify-start',
  CENTER: 'justify-center',
  MAX: 'justify-end',
  SPACE_BETWEEN: 'justify-between',
};

export function layoutToTailwind(layout: Layout): string {
  const classes: string[] = [];

  if (layout.mode === 'flex') {
    classes.push('flex');
    if (layout.direction === 'row') classes.push('flex-row');
    if (layout.direction === 'column') classes.push('flex-col');
    if (layout.gap != null) {
      const gap = nearestKey(GAP_MAP, layout.gap);
      if (gap) classes.push(gap);
    }
    if (layout.padding) {
      classes.push(...paddingClasses(layout.padding));
    }
    if (layout.alignItems) {
      const align = ALIGN_MAP[layout.alignItems];
      if (align) classes.push(align);
    }
    if (layout.justifyContent) {
      const justify = JUSTIFY_MAP[layout.justifyContent];
      if (justify) classes.push(justify);
    }
  }

  return classes.join(' ');
}

export function mergeClassNames(...parts: Array<string | undefined>): string {
  const tokens = parts.flatMap((p) => (p ?? '').split(/\s+/)).filter(Boolean);
  const kept: string[] = [];
  const groupSlot = new Map<string, number>();

  const groupOf = (cls: string): string | null => {
    if (cls === 'flex') return 'display-flex';
    if (cls === 'flex-row' || cls === 'flex-col') return 'flex-direction';
    if (cls.startsWith('items-')) return 'align-items';
    if (cls.startsWith('justify-')) return 'justify-content';
    if (cls.startsWith('gap-')) return 'gap';
    if (/^p-\d/.test(cls)) return 'padding';
    if (/^px-/.test(cls)) return 'padding-x';
    if (/^py-/.test(cls)) return 'padding-y';
    if (/^pt-/.test(cls)) return 'padding-top';
    if (/^pr-/.test(cls)) return 'padding-right';
    if (/^pb-/.test(cls)) return 'padding-bottom';
    if (/^pl-/.test(cls)) return 'padding-left';
    return null;
  };

  for (const cls of tokens) {
    const group = groupOf(cls);
    if (group) {
      const slot = groupSlot.get(group);
      if (slot != null) kept[slot] = cls;
      else {
        groupSlot.set(group, kept.length);
        kept.push(cls);
      }
    } else if (!kept.includes(cls)) {
      kept.push(cls);
    }
  }

  return kept.join(' ');
}
