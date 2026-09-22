import type { ComponentRef } from '../types/ir';

export interface RegistryRule {
  /** Match against mainComponent.name or node name */
  pattern: RegExp;
  ref: Omit<ComponentRef, 'library' | 'importFrom'>;
}

/**
 * Exact antd / Connex naming conventions (Phase 1).
 * Designers should use Figma Component names like `Button/Primary`, `Input/Search`.
 */
export const antdNamingRules: RegistryRule[] = [
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
  {
    pattern: /^Input\/Search$/i,
    ref: { component: 'Input', subComponent: 'Search', props: { placeholder: 'Search' } },
  },
  {
    pattern: /^Input\/Password$/i,
    ref: { component: 'Input', subComponent: 'Password', props: {} },
  },
  {
    pattern: /^Input$/i,
    ref: { component: 'Input', props: {} },
  },
  {
    pattern: /^Select$/i,
    ref: { component: 'Select', props: {} },
  },
  {
    // Whole-table only — do NOT match Table/Cell, Table/Header, etc.
    pattern: /^(Table|DataGrid|DataTable)$/i,
    ref: { component: 'Table', props: {} },
  },
  {
    pattern: /^Card$/i,
    ref: { component: 'Card', props: {} },
  },
  {
    pattern: /^Form$/i,
    ref: { component: 'Form', props: { layout: 'vertical' } },
  },
  {
    pattern: /^Modal$/i,
    ref: { component: 'Modal', props: { open: true } },
  },
  {
    pattern: /^Tabs$/i,
    ref: { component: 'Tabs', props: {} },
  },
  {
    pattern: /^Breadcrumb$/i,
    ref: { component: 'Breadcrumb', props: {} },
  },
  {
    pattern: /^Tag$/i,
    ref: { component: 'Tag', props: {} },
  },
  {
    pattern: /^Switch$/i,
    ref: { component: 'Switch', props: {} },
  },
  {
    pattern: /^Checkbox$/i,
    ref: { component: 'Checkbox', props: {} },
  },
  {
    pattern: /^Radio$/i,
    ref: { component: 'Radio', props: {} },
  },
  {
    pattern: /^DatePicker$/i,
    ref: { component: 'DatePicker', props: {} },
  },
  {
    pattern: /^Pagination$/i,
    ref: { component: 'Pagination', props: {} },
  },
  {
    pattern: /^Spin$/i,
    ref: { component: 'Spin', props: {} },
  },
  {
    pattern: /^Alert$/i,
    ref: { component: 'Alert', props: {} },
  },
  {
    pattern: /^Divider$/i,
    ref: { component: 'Divider', props: {} },
  },
  {
    pattern: /^Space$/i,
    ref: { component: 'Space', props: {} },
  },
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

/** Loose English fallbacks — runs after custom + TDesign aliases. */
export const antdFuzzyRules: RegistryRule[] = [
  {
    pattern: /timepicker|time.picker|time_picker|\btime\b/i,
    ref: { component: 'TimePicker', props: {} },
  },
  {
    pattern: /datepicker|date.picker|date_picker|date.range/i,
    ref: { component: 'DatePicker', props: {} },
  },
  {
    pattern: /segmented|tab bar|tab_bar/i,
    ref: { component: 'Segmented', props: {} },
  },
  {
    pattern: /\btabs\b/i,
    ref: { component: 'Tabs', props: {} },
  },
  {
    pattern: /\bselect\b|dropdown/i,
    ref: { component: 'Select', props: {} },
  },
  {
    pattern: /\btag\b/i,
    ref: { component: 'Tag', props: {} },
  },
  {
    pattern: /switch|toggle/i,
    ref: { component: 'Switch', props: {} },
  },
  {
    pattern: /\bbutton\b|btn/i,
    ref: { component: 'Button', props: {} },
  },
  {
    pattern: /\binput\b|textfield|text.field/i,
    ref: { component: 'Input', props: {} },
  },
  {
    pattern: /\bcheckbox\b/i,
    ref: { component: 'Checkbox', props: {} },
  },
  {
    pattern: /\bradio\b/i,
    ref: { component: 'Radio', props: {} },
  },
];

/** @deprecated Use antdNamingRules + antdFuzzyRules; kept for convenience. */
export const antdRegistryRules: RegistryRule[] = [...antdNamingRules, ...antdFuzzyRules];

export { matchAntdComponent } from './match-component';
