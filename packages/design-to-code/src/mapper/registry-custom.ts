import type { RegistryRule } from './registry-antd';

/**
 * Designer / Connex custom Figma components → antd.
 * Matched after antd exact names, before TDesign / MUI aliases.
 *
 * Known designer components: Select, Checkbox, Button, Typography.
 * Table Column is intentionally omitted — parent frame → Table via heuristic-table.
 *
 * Typography scale (Inter) from design system:
 *   Display 64 | H1 48 | H2 36 | H3 24 | Subtitle1 20 | Subtitle2 18
 *   Body1 16 | Body2 14 | Body3 12  × {Semibold, Regular}
 */

function typo(
  pattern: RegExp,
  sub: 'Title' | 'Text',
  props: Record<string, unknown>,
): RegistryRule {
  return {
    pattern,
    ref: { component: 'Typography', subComponent: sub, props },
  };
}

/** Optional `Typography/` prefix; weight optional (defaults Semibold for headings). */
function scale(name: string, size: number, weight?: 'Semibold' | 'Regular'): string {
  const w = weight ? `\\s+${weight}` : '(?:\\s+(?:Semibold|Regular))?';
  return `^(?:Typography\\/)?${name}\\s*${size}${w}$`;
}

export const customRegistryRules: RegistryRule[] = [
  // —— Button ——
  {
    pattern: /^Button\/Primary$/i,
    ref: { component: 'Button', props: { type: 'primary' } },
  },
  {
    pattern: /^Button\/Default$/i,
    ref: { component: 'Button', props: {} },
  },
  {
    pattern: /^Button\/Danger$/i,
    ref: { component: 'Button', props: { danger: true } },
  },
  {
    pattern: /^Button\/Link$/i,
    ref: { component: 'Button', props: { type: 'link' } },
  },
  {
    pattern: /^Button\/Text$/i,
    ref: { component: 'Button', props: { type: 'text' } },
  },
  {
    pattern: /^Button$/i,
    ref: { component: 'Button', props: {} },
  },

  // —— Select ——
  {
    pattern: /^Select\/Multiple$/i,
    ref: { component: 'Select', props: { mode: 'multiple' } },
  },
  {
    pattern: /^Select$/i,
    ref: { component: 'Select', props: {} },
  },

  // —— Checkbox ——
  {
    pattern: /^Checkbox$/i,
    ref: { component: 'Checkbox', props: {} },
  },

  // —— Typography scale (designer tokens) ——
  // Display 64
  typo(new RegExp(scale('Display', 64, 'Semibold'), 'i'), 'Title', {
    level: 1,
    className: 'text-[64px] font-semibold leading-none',
  }),
  typo(new RegExp(scale('Display', 64, 'Regular'), 'i'), 'Title', {
    level: 1,
    className: 'text-[64px] font-normal leading-none',
  }),
  typo(new RegExp(scale('Display', 64), 'i'), 'Title', {
    level: 1,
    className: 'text-[64px] font-semibold leading-none',
  }),

  // H1 48
  typo(new RegExp(scale('H1', 48, 'Semibold'), 'i'), 'Title', {
    level: 1,
    className: 'text-5xl font-semibold',
  }),
  typo(new RegExp(scale('H1', 48, 'Regular'), 'i'), 'Title', {
    level: 1,
    className: 'text-5xl font-normal',
  }),
  typo(new RegExp(scale('H1', 48), 'i'), 'Title', {
    level: 1,
    className: 'text-5xl font-semibold',
  }),

  // H2 36
  typo(new RegExp(scale('H2', 36, 'Semibold'), 'i'), 'Title', {
    level: 2,
    className: 'text-4xl font-semibold',
  }),
  typo(new RegExp(scale('H2', 36, 'Regular'), 'i'), 'Title', {
    level: 2,
    className: 'text-4xl font-normal',
  }),
  typo(new RegExp(scale('H2', 36), 'i'), 'Title', {
    level: 2,
    className: 'text-4xl font-semibold',
  }),

  // H3 24
  typo(new RegExp(scale('H3', 24, 'Semibold'), 'i'), 'Title', {
    level: 3,
    className: 'text-2xl font-semibold',
  }),
  typo(new RegExp(scale('H3', 24, 'Regular'), 'i'), 'Title', {
    level: 3,
    className: 'text-2xl font-normal',
  }),
  typo(new RegExp(scale('H3', 24), 'i'), 'Title', {
    level: 3,
    className: 'text-2xl font-semibold',
  }),

  // Subtitle1 20
  typo(new RegExp(scale('Subtitle1', 20, 'Semibold'), 'i'), 'Title', {
    level: 4,
    className: 'text-xl font-semibold',
  }),
  typo(new RegExp(scale('Subtitle1', 20, 'Regular'), 'i'), 'Title', {
    level: 4,
    className: 'text-xl font-normal',
  }),
  typo(new RegExp(scale('Subtitle1', 20), 'i'), 'Title', {
    level: 4,
    className: 'text-xl font-semibold',
  }),

  // Subtitle2 18
  typo(new RegExp(scale('Subtitle2', 18, 'Semibold'), 'i'), 'Text', {
    strong: true,
    className: 'text-lg',
  }),
  typo(new RegExp(scale('Subtitle2', 18, 'Regular'), 'i'), 'Text', {
    className: 'text-lg',
  }),
  typo(new RegExp(scale('Subtitle2', 18), 'i'), 'Text', {
    strong: true,
    className: 'text-lg',
  }),

  // Body1 16
  typo(new RegExp(scale('Body1', 16, 'Semibold'), 'i'), 'Text', {
    strong: true,
    className: 'text-base',
  }),
  typo(new RegExp(scale('Body1', 16, 'Regular'), 'i'), 'Text', {
    className: 'text-base',
  }),
  typo(new RegExp(scale('Body1', 16), 'i'), 'Text', {
    className: 'text-base',
  }),

  // Body2 14
  typo(new RegExp(scale('Body2', 14, 'Semibold'), 'i'), 'Text', {
    strong: true,
    className: 'text-sm',
  }),
  typo(new RegExp(scale('Body2', 14, 'Regular'), 'i'), 'Text', {
    className: 'text-sm',
  }),
  typo(new RegExp(scale('Body2', 14), 'i'), 'Text', {
    className: 'text-sm',
  }),

  // Body3 12
  typo(new RegExp(scale('Body3', 12, 'Semibold'), 'i'), 'Text', {
    strong: true,
    className: 'text-xs',
  }),
  typo(new RegExp(scale('Body3', 12, 'Regular'), 'i'), 'Text', {
    className: 'text-xs',
  }),
  typo(new RegExp(scale('Body3', 12), 'i'), 'Text', {
    className: 'text-xs',
  }),

  // —— Typography generic (antd-style names) ——
  {
    pattern: /^Typography\/Title$/i,
    ref: { component: 'Typography', subComponent: 'Title', props: { level: 4 } },
  },
  {
    pattern: /^Typography\/Text$/i,
    ref: { component: 'Typography', subComponent: 'Text', props: {} },
  },
  {
    pattern: /^Typography\/Paragraph$/i,
    ref: { component: 'Typography', subComponent: 'Paragraph', props: {} },
  },
  {
    pattern: /^Typography$/i,
    ref: { component: 'Typography', subComponent: 'Text', props: {} },
  },
];
