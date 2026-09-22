import type { RegistryRule } from './registry-antd';

/**
 * MUI (Material UI) Figma kit → antd.
 * Designers use Material Input (not antd Input) in Connex files.
 * Names: `MuiInput`, `TextField`, `OutlinedInput`, `Material Input`, etc.
 */
export const muiRegistryRules: RegistryRule[] = [
  {
    // Tabs root only — Tab / MuiTab items are excluded in match-component
    pattern: /^(Mui)?Tabs\b|TabList|TabContext/i,
    ref: { component: 'Tabs', props: {} },
  },
  {
    pattern: /^(Mui)?Button\b|IconButton/i,
    ref: { component: 'Button', props: {} },
  },
  // —— Input (Material / MUI kit — design file uses these, not antd Input) ——
  {
    pattern: /^(SearchField|SearchBox|Input\/Search)$/i,
    ref: { component: 'Input', subComponent: 'Search', props: { placeholder: 'Search' } },
  },
  {
    pattern: /^Input\/Password$/i,
    ref: { component: 'Input', subComponent: 'Password', props: {} },
  },
  {
    pattern: /^(Mui)?TextField\b/i,
    ref: { component: 'Input', props: {} },
  },
  {
    pattern: /^(Mui)?(Outlined|Filled|Standard)?Input(Base)?(-root)?$/i,
    ref: { component: 'Input', props: {} },
  },
  {
    pattern: /^(Mui)?(Outlined|Filled|Standard)Input\b/i,
    ref: { component: 'Input', props: {} },
  },
  {
    pattern: /^Material\s*Input\b|^material\/input\b/i,
    ref: { component: 'Input', props: {} },
  },
  {
    pattern: /^(Outlined|Filled|Standard)\s*text\s*fields?\b|^Text\s*fields?\b/i,
    ref: { component: 'Input', props: {} },
  },
  {
    pattern: /^Input\/(Outlined|Filled|Standard)$/i,
    ref: { component: 'Input', props: {} },
  },
  {
    pattern: /^(Mui)?InputAdornment\b/i,
    ref: { component: 'Input', props: {} },
  },
  {
    pattern: /^(Mui)?Select\b|NativeSelect|Autocomplete/i,
    ref: { component: 'Select', props: {} },
  },
  {
    // Exact only — do NOT match "Table Column" / "TableCell"
    pattern: /^(Mui)?(DataGrid|Table)$/i,
    ref: { component: 'Table', props: {} },
  },
  {
    pattern: /^(Mui)?DatePicker\b|DateRangePicker|DesktopDatePicker/i,
    ref: { component: 'DatePicker', props: {} },
  },
  {
    pattern: /^(Mui)?TimePicker\b|DesktopTimePicker/i,
    ref: { component: 'TimePicker', props: {} },
  },
  {
    pattern: /^(Mui)?(Dialog|Modal)\b/i,
    ref: { component: 'Modal', props: { open: true } },
  },
  {
    pattern: /^(Mui)?Drawer\b|SwipeableDrawer/i,
    ref: { component: 'Drawer', props: { open: true } },
  },
  {
    pattern: /^(Mui)?(CircularProgress|LinearProgress|Backdrop)\b/i,
    ref: { component: 'Spin', props: {} },
  },
  {
    pattern: /^(Mui)?Alert\b|Snackbar/i,
    ref: { component: 'Alert', props: {} },
  },
  {
    pattern: /^(Mui)?Switch\b/i,
    ref: { component: 'Switch', props: {} },
  },
  {
    pattern: /^(Mui)?Checkbox\b/i,
    ref: { component: 'Checkbox', props: {} },
  },
  {
    pattern: /^(Mui)?Radio\b|RadioGroup/i,
    ref: { component: 'Radio', props: {} },
  },
  {
    pattern: /^(Mui)?Chip\b/i,
    ref: { component: 'Tag', props: {} },
  },
  {
    pattern: /^(Mui)?Pagination\b/i,
    ref: { component: 'Pagination', props: {} },
  },
  {
    pattern: /^(Mui)?Card\b/i,
    ref: { component: 'Card', props: {} },
  },
  {
    pattern: /^(Mui)?Breadcrumbs\b/i,
    ref: { component: 'Breadcrumb', props: {} },
  },
  {
    pattern: /^(Mui)?Divider\b/i,
    ref: { component: 'Divider', props: {} },
  },
  {
    pattern: /^(Mui)?Typography\b/i,
    ref: { component: 'Typography', subComponent: 'Text', props: {} },
  },
];
