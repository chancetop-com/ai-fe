import type {
  ComponentRef,
  DesignIR,
  DesignNode,
  GenerateOptions,
  GenerateResult,
  Layout,
  OutputStack,
} from '../types/ir';
import {
  collectTextLabels,
  extractTextContent,
  shouldRenderComponentWithLabel,
} from '../mapper/simplify-ir';
import { layoutToTailwind, mergeClassNames, paddingToTailwind } from '../utils/tailwind';

interface ImportEntry {
  component: string;
  subComponents: Set<string>;
}

interface RenderCtx {
  /** antd Flex only when stack === 'antd' */
  useAntdFlex: boolean;
}

function addImport(imports: Map<string, ImportEntry>, component: string): void {
  if (!imports.has(component)) {
    imports.set(component, { component, subComponents: new Set() });
  }
}

function collectImports(
  node: DesignNode,
  imports: Map<string, ImportEntry>,
  ctx: RenderCtx,
): void {
  if (node.componentRef) {
    const key = node.componentRef.component;
    const entry = imports.get(key) ?? { component: key, subComponents: new Set() };
    if (node.componentRef.subComponent) {
      entry.subComponents.add(node.componentRef.subComponent);
    }
    imports.set(key, entry);
  }
  if (ctx.useAntdFlex && isFlexLayout(node.layout)) {
    addImport(imports, 'Flex');
  }
  node.children?.forEach((child) => collectImports(child, imports, ctx));
}

const ALIGN_PROP: Record<string, string> = {
  MIN: 'flex-start',
  CENTER: 'center',
  MAX: 'flex-end',
  BASELINE: 'baseline',
  STRETCH: 'stretch',
  'items-start': 'flex-start',
  'items-center': 'center',
  'items-end': 'flex-end',
  'items-baseline': 'baseline',
  'items-stretch': 'stretch',
};

const JUSTIFY_PROP: Record<string, string> = {
  MIN: 'flex-start',
  CENTER: 'center',
  MAX: 'flex-end',
  SPACE_BETWEEN: 'space-between',
  'justify-start': 'flex-start',
  'justify-center': 'center',
  'justify-end': 'flex-end',
  'justify-between': 'space-between',
};

const GAP_FROM_CLASS: Record<string, number> = {
  'gap-0': 0,
  'gap-1': 4,
  'gap-2': 8,
  'gap-3': 12,
  'gap-4': 16,
  'gap-5': 20,
  'gap-6': 24,
  'gap-8': 32,
  'gap-10': 40,
  'gap-12': 48,
};

function isFlexLayout(layout?: Layout): boolean {
  if (!layout) return false;
  if (layout.mode === 'flex') return true;
  return Boolean(layout.className?.split(/\s+/).includes('flex'));
}

const PADDING_CLASS_RE = /^(p|px|py|pt|pr|pb|pl)-\d+$/;

function layoutToFlexProps(layout: Layout): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const classes = new Set((layout.className ?? '').split(/\s+/).filter(Boolean));

  const isColumn = layout.direction === 'column' || classes.has('flex-col');
  if (isColumn) {
    props.vertical = true;
  }

  if (layout.gap != null) {
    props.gap = layout.gap;
  } else {
    for (const cls of classes) {
      if (GAP_FROM_CLASS[cls] != null) {
        props.gap = GAP_FROM_CLASS[cls];
        break;
      }
    }
  }

  const alignKey = layout.alignItems ?? [...classes].find((c) => c.startsWith('items-'));
  if (alignKey && ALIGN_PROP[alignKey] && ALIGN_PROP[alignKey] !== 'flex-start') {
    props.align = ALIGN_PROP[alignKey];
  }

  const justifyKey =
    layout.justifyContent ?? [...classes].find((c) => c.startsWith('justify-'));
  if (justifyKey && JUSTIFY_PROP[justifyKey] && JUSTIFY_PROP[justifyKey] !== 'flex-start') {
    props.justify = JUSTIFY_PROP[justifyKey];
  }

  const fromBox = paddingToTailwind(layout.padding);
  const fromClass = [...classes]
    .filter((c) => PADDING_CLASS_RE.test(c) && !/-0$/.test(c))
    .join(' ');
  const className = mergeClassNames(fromBox, fromClass);
  if (className) {
    props.className = className;
  }

  return props;
}

/** Full Tailwind layout classes for non-antd stacks. */
function layoutClassName(node: DesignNode): string {
  const fromLayout = node.layout ? layoutToTailwind(node.layout) : '';
  return mergeClassNames(fromLayout, node.layout?.className, node.style?.className);
}

function jsxLiteral(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => jsxLiteral(item)).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${jsxLiteral(v)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return JSON.stringify(value);
}

function formatProps(props: Record<string, unknown>): string {
  const entries = Object.entries(props).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  const inner = entries
    .map(([k, v]) => {
      if (typeof v === 'string') return `${k}="${v}"`;
      if (typeof v === 'boolean' && v) return k;
      if (typeof v === 'boolean') return `${k}={false}`;
      return `${k}={${jsxLiteral(v)}}`;
    })
    .join(' ');
  return ` ${inner}`;
}

function componentOpenTag(ref: ComponentRef): string {
  if (ref.subComponent) {
    return `${ref.component}.${ref.subComponent}`;
  }
  return ref.component;
}

function componentCloseTag(ref: ComponentRef): string {
  return componentOpenTag(ref);
}

function escapeJsxChildren(text: string): string {
  // Figma placeholders like "{Promotion name}" must not become JSX expressions
  if (/[{}<>&]/.test(text)) {
    return `{${JSON.stringify(text)}}`;
  }
  return text;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const SELF_CLOSING_COMPONENTS = new Set([
  'Switch',
  'Checkbox',
  'DatePicker',
  'TimePicker',
  'Select',
  'Input',
  'Table',
]);

function isSelfClosingComponent(ref: ComponentRef): boolean {
  if (ref.subComponent === 'Group' || ref.subComponent === 'Item') return false;
  if (ref.component === 'Input' && ref.subComponent) return false;
  return SELF_CLOSING_COMPONENTS.has(ref.component);
}

function renderSegmented(node: DesignNode, indent: string, ref: ComponentRef): string {
  const labels = collectTextLabels(node);
  if (labels.length === 0) {
    return `${indent}<Segmented />`;
  }
  const options = labels
    .map((label) => `{ label: '${label.replace(/'/g, "\\'")}', value: '${slugify(label)}' }`)
    .join(', ');
  const props = formatProps(ref.props);
  return `${indent}<Segmented${props} options={[${options}]} />`;
}

/** One label per tab item; unwrap kit wrappers like `items-count`. */
function collectTabItemLabels(node: DesignNode): string[] {
  let kids = node.children ?? [];
  if (!kids.length) return collectTextLabels(node);

  // antd kit: Tabs → items-count → [Tab, Tab, …]
  if (
    kids.length === 1 &&
    (kids[0]!.children?.length ?? 0) >= 2 &&
    !kids[0]!.componentRef
  ) {
    kids = kids[0]!.children!;
  }

  const labels: string[] = [];
  for (const child of kids) {
    const texts = collectTextLabels(child);
    const label = texts.find((t) => t.trim().length > 0);
    if (label) labels.push(label);
  }
  return labels;
}

function renderTabs(node: DesignNode, indent: string, ref: ComponentRef): string {
  const labels = collectTabItemLabels(node);
  if (labels.length === 0) {
    return `${indent}<Tabs${formatProps(ref.props)} />`;
  }
  const items = labels.map((label, i) => ({
    key: slugify(label) || String(i),
    label,
  }));
  const props = formatProps({ ...ref.props, items });
  return `${indent}<Tabs${props} />`;
}

function renderNode(node: DesignNode, depth: number, ctx: RenderCtx): string {
  const indent = '  '.repeat(depth);

  if (node.type === 'text' && node.text) {
    const raw = node.text.characters.replace(/\n/g, ' ').trim();
    const text = escapeJsxChildren(raw);
    if (node.componentRef) {
      const open = componentOpenTag(node.componentRef);
      const close = componentCloseTag(node.componentRef);
      return `${indent}<${open}${formatProps(node.componentRef.props)}>${text}</${close}>`;
    }
    const className = mergeClassNames(node.text.className, node.style?.className);
    if (className) {
      return `${indent}<span className="${className}">${text}</span>`;
    }
    return `${indent}<span>${text}</span>`;
  }

  if (node.componentRef) {
    const ref = node.componentRef;

    if (ref.component === 'Segmented') {
      return renderSegmented(node, indent, ref);
    }

    if (ref.component === 'Tabs') {
      return renderTabs(node, indent, ref);
    }

    if (ref.component === 'Alert') {
      const childContent = node.children
        ?.map((c) => renderNode(c, depth + 1, ctx))
        .filter(Boolean)
        .join('\n');
      if (childContent) {
        return `${indent}<Alert${formatProps(ref.props)} description={(\n${childContent}\n${indent})} />`;
      }
      return `${indent}<Alert${formatProps(ref.props)} />`;
    }

    const open = componentOpenTag(ref);
    const close = componentCloseTag(ref);
    const props = formatProps(ref.props);

    if (!isSelfClosingComponent(ref) && (ref.subComponent === 'Item' || ref.subComponent === 'Group')) {
      const childContent = node.children
        ?.map((c) => renderNode(c, depth + 1, ctx))
        .filter(Boolean)
        .join('\n');
      if (childContent) {
        return `${indent}<${open}${props}>\n${childContent}\n${indent}</${close}>`;
      }
      return `${indent}<${open}${props} />`;
    }

    if (isSelfClosingComponent(ref)) {
      return `${indent}<${open}${props} />`;
    }

    if (shouldRenderComponentWithLabel(node)) {
      const label = escapeJsxChildren(extractTextContent(node)!);
      return `${indent}<${open}${props}>${label}</${close}>`;
    }

    const label = inferComponentLabel(node);
    const safeLabel = label ? escapeJsxChildren(label) : undefined;

    if (safeLabel && isTextOnlySubtree(node.children)) {
      return `${indent}<${open}${props}>${safeLabel}</${close}>`;
    }

    const childContent = node.children
      ?.map((c) => renderNode(c, depth + 1, ctx))
      .filter(Boolean)
      .join('\n');
    if (childContent) {
      return `${indent}<${open}${props}>\n${childContent}\n${indent}</${close}>`;
    }
    if (safeLabel) {
      return `${indent}<${open}${props}>${safeLabel}</${close}>`;
    }
    return `${indent}<${open}${props} />`;
  }

  const children = node.children
    ?.map((c) => renderNode(c, depth + 1, ctx))
    .filter(Boolean)
    .join('\n');

  if (!children) {
    return '';
  }

  // antd only: Flex component; otherwise Tailwind utilities on div
  if (ctx.useAntdFlex && isFlexLayout(node.layout)) {
    const flexProps = formatProps(layoutToFlexProps(node.layout!));
    return `${indent}<Flex${flexProps}>\n${children}\n${indent}</Flex>`;
  }

  const className = layoutClassName(node);
  if (className) {
    return `${indent}<div className="${className}">\n${children}\n${indent}</div>`;
  }
  return `${indent}<div>\n${children}\n${indent}</div>`;
}

function inferComponentLabel(node: DesignNode): string | undefined {
  if (node.text?.characters) return node.text.characters.trim();
  for (const child of node.children ?? []) {
    const label = inferComponentLabel(child);
    if (label) return label;
  }
  return undefined;
}

function isTextOnlySubtree(nodes: DesignNode[] | undefined): boolean {
  if (!nodes?.length) return false;
  return nodes.every((n) => {
    if (n.componentRef) return false;
    if (n.type === 'text') return true;
    return n.children != null && n.children.length > 0 && isTextOnlySubtree(n.children);
  });
}

function buildImportLines(
  imports: Map<string, ImportEntry>,
  stack: OutputStack,
): string[] {
  if (stack !== 'antd' || imports.size === 0) {
    return [];
  }
  const names = [...imports.keys()].sort();
  return [`import { ${names.join(', ')} } from 'antd';`];
}

function toViewName(ir: DesignIR, options: GenerateOptions): string {
  if (options.viewName) return options.viewName;
  const base = ir.meta.name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return `${base || 'Page'}View`;
}

export function generateReact(ir: DesignIR, options: GenerateOptions): GenerateResult {
  const ctx: RenderCtx = { useAntdFlex: options.stack === 'antd' };
  const imports = new Map<string, ImportEntry>();
  collectImports(ir.root, imports, ctx);

  const importLines = buildImportLines(imports, options.stack);
  const viewName = toViewName(ir, options);
  const body = renderNode(ir.root, 2, ctx);

  const preamble = importLines.length ? `${importLines.join('\n')}\n\n` : '';

  const code = `${preamble}/**
 * Static view — wire data in Container page (CLI-generated).
 * Source: ${ir.meta.figmaFileKey ?? 'figma'} node ${ir.meta.figmaNodeId ?? ''}
 */
export function ${viewName}() {
  return (
${body}
  );
}
`;

  return {
    code,
    imports: importLines,
  };
}
