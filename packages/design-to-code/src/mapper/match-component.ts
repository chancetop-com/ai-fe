import type { ComponentRef } from '../types/ir';
import { antdFuzzyRules, antdNamingRules, type RegistryRule } from './registry-antd';
import { customRegistryRules } from './registry-custom';
import { muiRegistryRules } from './registry-mui';
import { tdesignRegistryRules } from './registry-tdesign';

function toRef(rule: RegistryRule): ComponentRef {
  return {
    library: 'antd',
    importFrom: 'antd',
    component: rule.ref.component,
    subComponent: rule.ref.subComponent,
    props: { ...rule.ref.props },
  };
}

/** TDesign / MUI / antd-kit tab *items* — must not map to Tabs. */
export function isTabItemName(name: string): boolean {
  return (
    /^item\//i.test(name) ||
    /^item\b/i.test(name) ||
    /\/item\//i.test(name) ||
    /^TabItem\b/i.test(name) ||
    /^MuiTab\b/i.test(name) ||
    // antd Figma kit: `.Components/Tab(Legacy)`, `Components/Tab`, …
    /\.Components\/Tab\b/i.test(name) ||
    /^Components\/Tab\b/i.test(name) ||
    /\/Tab\(Legacy\)/i.test(name) ||
    /^Tab\(Legacy\)/i.test(name) ||
    // bare Tab item (not Tabs root)
    /^Tab$/i.test(name)
  );
}

/** antd / kit Tabs *root* containers (not individual Tab items). */
export function isTabsRootName(name: string): boolean {
  if (isTabItemName(name)) return false;
  return (
    /^Tabs$/i.test(name) ||
    /^\.?Tabs([-_./]|\s|\(|$)/i.test(name) || // .Tabs-Top(Legacy), Tabs/Top, …
    /^(Td)?Tabs\b/i.test(name) ||
    /^normalTabs\b/i.test(name)
  );
}

/**
 * Match order (first hit wins):
 * 1. Tabs root / tab-item guards
 * 2. antd exact naming
 * 3. designer custom aliases
 * 4. TDesign kit
 * 5. MUI kit
 * 6. antd fuzzy fallbacks
 */
export function matchAntdComponent(
  name: string,
  mainComponentName?: string,
): ComponentRef | undefined {
  // Tab item instances must stay unlabeled so the parent Tabs collects their text
  if (isTabItemName(name) || (mainComponentName && isTabItemName(mainComponentName))) {
    return undefined;
  }

  const candidates = [mainComponentName, name].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (isTabsRootName(candidate)) {
      return {
        library: 'antd',
        importFrom: 'antd',
        component: 'Tabs',
        props: {},
      };
    }
  }

  const ruleSets: RegistryRule[][] = [
    antdNamingRules,
    customRegistryRules,
    tdesignRegistryRules,
    muiRegistryRules,
    antdFuzzyRules,
  ];

  for (const candidate of candidates) {
    for (const rules of ruleSets) {
      for (const rule of rules) {
        if (rule.pattern.test(candidate)) {
          return toRef(rule);
        }
      }
    }
  }

  return undefined;
}
