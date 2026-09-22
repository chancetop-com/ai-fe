import type { DesignIR, GenerateOptions, GenerateResult } from './types/ir';
import { mapAntdComponents } from './mapper/map-antd';
import { mapFormHeuristics } from './mapper/heuristic-form';
import { mapTableHeuristics } from './mapper/heuristic-table';
import { simplifyIR } from './mapper/simplify-ir';
import { generateHtml } from './generator/html';
import { generateReact } from './generator/react';

export function generate(ir: DesignIR, options: GenerateOptions): GenerateResult {
  const stack = options.stack;
  let prepared: DesignIR = { ...ir, stack };

  if (stack === 'antd') {
    const mapped = mapAntdComponents(prepared);
    const withForm = mapFormHeuristics(mapped);
    const withTable = mapTableHeuristics(withForm);
    prepared = simplifyIR(withTable);
  } else {
    prepared = simplifyIR(prepared);
  }

  if (options.format === 'html') {
    return generateHtml(prepared, options);
  }
  return generateReact(prepared, options);
}

export function generateFromIR(
  ir: DesignIR,
  format: GenerateOptions['format'] = 'react',
  viewName?: string,
): GenerateResult {
  return generate(ir, {
    stack: 'antd',
    format,
    viewName,
  });
}

export type {
  Box,
  ComponentRef,
  DesignIR,
  DesignNode,
  DesignNodeType,
  FlexDirection,
  GenerateOptions,
  GenerateResult,
  Layout,
  LayoutMode,
  NodeStyle,
  OutputFormat,
  OutputStack,
  TextContent,
} from './types/ir';

export { antdRegistryRules, antdNamingRules, antdFuzzyRules, matchAntdComponent } from './mapper/registry-antd';
export { tdesignRegistryRules } from './mapper/registry-tdesign';
export { muiRegistryRules } from './mapper/registry-mui';
export { customRegistryRules } from './mapper/registry-custom';
export { mapAntdComponents } from './mapper/map-antd';
export { simplifyIR, extractTextContent, collectTextLabels } from './mapper/simplify-ir';
export { mapFormHeuristics } from './mapper/heuristic-form';
export { mapTableHeuristics } from './mapper/heuristic-table';
export { generateReact } from './generator/react';
export { generateHtml } from './generator/html';
export { layoutToTailwind, mergeClassNames, paddingToTailwind } from './utils/tailwind';
