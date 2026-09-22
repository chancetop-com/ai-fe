import type { RegistryRule } from './registry-antd';

/**
 * TDesign Figma kit (English component names) → antd.
 *
 * Examples from Connex designs:
 * - `normalTabs 选项卡-默认主题` → Tabs (root only)
 * - `item/normalTabs/top/l` → NOT Tabs (tab item; labels collected by generator)
 * - `Button`, `Input`, `BaseTable`, …
 */
export const tdesignRegistryRules: RegistryRule[] = [
  // —— Tabs (root only; exclude item/normalTabs/…) ——
  {
    pattern: /^normalTabs\b/i,
    ref: { component: 'Tabs', props: {} },
  },
  {
    pattern: /^(Tabs|TdTabs)\b/i,
    ref: { component: 'Tabs', props: {} },
  },

  // —— Button ——
  {
    pattern: /^(Button|TButton)\b/i,
    ref: { component: 'Button', props: {} },
  },

  // —— Input ——
  {
    pattern: /^(Input|TInput)\b/i,
    ref: { component: 'Input', props: {} },
  },
  {
    pattern: /^(InputAdornment|Search|SearchInput)\b/i,
    ref: { component: 'Input', subComponent: 'Search', props: { placeholder: 'Search' } },
  },

  // —— Select ——
  {
    pattern: /^(Select|TSelect)\b/i,
    ref: { component: 'Select', props: {} },
  },
  {
    pattern: /^(SelectInput|MultipleSelect|MultiSelect)\b/i,
    ref: { component: 'Select', props: { mode: 'multiple' } },
  },

  // —— Table ——
  // Exact kit names only — do NOT match "Table Column" / "TableCell" / etc.
  {
    pattern: /^(BaseTable|PrimaryTable|TTable)$/i,
    ref: { component: 'Table', props: {} },
  },
  {
    pattern: /^Table$/i,
    ref: { component: 'Table', props: {} },
  },

  // —— Date / Time ——
  {
    pattern: /^(DateRangePicker|RangePicker)\b/i,
    ref: { component: 'DatePicker', props: {} },
  },
  {
    pattern: /^(DatePicker|TDatePicker)\b/i,
    ref: { component: 'DatePicker', props: {} },
  },
  {
    pattern: /^(TimePicker|TTimePicker)\b/i,
    ref: { component: 'TimePicker', props: {} },
  },

  // —— Feedback ——
  {
    pattern: /^(Dialog|TDialog)\b/i,
    ref: { component: 'Modal', props: { open: true } },
  },
  {
    pattern: /^(Drawer|TDrawer)\b/i,
    ref: { component: 'Drawer', props: { open: true } },
  },
  {
    pattern: /^(Loading|TLoading)\b/i,
    ref: { component: 'Spin', props: {} },
  },
  {
    pattern: /^(Alert|TAlert|Message)\b/i,
    ref: { component: 'Alert', props: {} },
  },

  // —— Form controls ——
  {
    pattern: /^(Switch|TSwitch)\b/i,
    ref: { component: 'Switch', props: {} },
  },
  {
    pattern: /^(Checkbox|TCheckbox)\b/i,
    ref: { component: 'Checkbox', props: {} },
  },
  {
    pattern: /^(Radio|TRadio)\b/i,
    ref: { component: 'Radio', props: {} },
  },
  {
    pattern: /^(Tag|TTag)\b/i,
    ref: { component: 'Tag', props: {} },
  },
  {
    pattern: /^(Pagination|TPagination)\b/i,
    ref: { component: 'Pagination', props: {} },
  },
  {
    pattern: /^(Form|TForm)\b/i,
    ref: { component: 'Form', props: { layout: 'vertical' } },
  },
  {
    pattern: /^(Card|TCard)\b/i,
    ref: { component: 'Card', props: {} },
  },
  {
    pattern: /^(Breadcrumb|TBreadcrumb)\b/i,
    ref: { component: 'Breadcrumb', props: {} },
  },
  {
    pattern: /^(Divider|TDivider)\b/i,
    ref: { component: 'Divider', props: {} },
  },
];
