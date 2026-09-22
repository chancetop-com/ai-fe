import type { DesignIR, DesignNode } from '../types/ir';

function isRenderable(node: DesignNode): boolean {
  if (node.componentRef) return true;
  if (node.type === 'text' && node.text?.characters.trim()) return true;
  return node.children?.some(isRenderable) ?? false;
}

function isLayoutShell(node: DesignNode): boolean {
  return !node.componentRef && node.type !== 'text';
}

function classNameOf(node: DesignNode): string {
  return node.layout?.className ?? node.style?.className ?? '';
}

/** Keep wrappers that actually express alignment (e.g. footer actions). */
function hasExpressiveAlignment(node: DesignNode): boolean {
  return /\b(justify-end|justify-between)\b/.test(classNameOf(node));
}

/** Keep shells that carry spacing the Form child would otherwise lose. */
function hasExpressiveSpacing(node: DesignNode): boolean {
  const layout = node.layout;
  if (!layout) return false;
  if (layout.gap != null && layout.gap > 0) return true;
  const p = layout.padding;
  if (p && (p.top || p.right || p.bottom || p.left)) return true;
  return /\b(p-|px-|py-|pt-|pr-|pb-|pl-|gap-)/.test(classNameOf(node));
}

function isComponent(node: DesignNode): boolean {
  return Boolean(node.componentRef);
}

function simplifyNode(node: DesignNode): DesignNode | null {
  const children = node.children
    ?.map(simplifyNode)
    .filter((child): child is DesignNode => child != null);

  let simplified: DesignNode = {
    ...node,
    children: children?.length ? children : undefined,
  };

  if (!isRenderable(simplified)) return null;

  while (isLayoutShell(simplified) && simplified.children?.length === 1) {
    const child = simplified.children[0]!;
    if (child.type === 'text') {
      simplified = child;
      continue;
    }
    if (isComponent(child) && (hasExpressiveAlignment(simplified) || hasExpressiveSpacing(simplified))) {
      break;
    }
    simplified = child;
  }

  return simplified;
}

export function simplifyIR(ir: DesignIR): DesignIR {
  const root = simplifyNode(ir.root);
  return { ...ir, root: root ?? ir.root };
}

function hasNestedComponent(node: DesignNode): boolean {
  return node.children?.some((c) => c.componentRef || hasNestedComponent(c)) ?? false;
}

/** Prefer plain label for leaf components (Button, Tag, etc.) */
export function extractTextContent(node: DesignNode): string | undefined {
  if (node.text?.characters.trim()) return node.text.characters.trim();
  if (!node.children?.length) return undefined;
  const parts = node.children.map(extractTextContent).filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}

/** Collect direct & nested text leaf strings (for Segmented options, etc.) */
export function collectTextLabels(node: DesignNode): string[] {
  if (node.type === 'text' && node.text?.characters.trim()) {
    return [node.text.characters.trim()];
  }
  if (!node.children?.length) return [];
  return node.children.flatMap(collectTextLabels);
}

export function shouldRenderComponentWithLabel(node: DesignNode): boolean {
  if (!node.componentRef) return false;
  const label = extractTextContent(node);
  if (!label) return false;
  return !hasNestedComponent(node);
}
