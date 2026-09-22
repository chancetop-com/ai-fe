import type { DesignIR, DesignNode } from '../types/ir';
import { isTabItemName, isTabsRootName, matchAntdComponent } from './match-component';

/** Apply antd component mapping to INSTANCE nodes in the IR tree */
export function mapAntdComponents(ir: DesignIR): DesignIR {
  return {
    ...ir,
    root: mapNode(ir.root),
  };
}

function collectTexts(node: DesignNode): string[] {
  if (node.type === 'text' && node.text?.characters.trim()) {
    return [node.text.characters.trim()];
  }
  return node.children?.flatMap(collectTexts) ?? [];
}

function nodeNames(node: DesignNode): string[] {
  return [node.name, node.mainComponentName].filter(Boolean) as string[];
}

function isTabItemNode(node: DesignNode): boolean {
  return nodeNames(node).some(isTabItemName);
}

/**
 * Figma Ant Design kits often name every cell/header instance with mainComponent "Table".
 * Only keep a Table mapping when the node itself looks like a multi-column grid.
 */
function looksLikeFullTable(node: DesignNode): boolean {
  const kids = node.children ?? [];
  if (kids.length < 3) return false;
  const columnish = kids.filter((child) => collectTexts(child).length >= 2);
  return columnish.length >= 3;
}

function tabItemsUnder(node: DesignNode): DesignNode[] {
  const kids = node.children ?? [];
  const direct = kids.filter(isTabItemNode);
  if (direct.length >= 2) return direct;

  // Common antd kit: Tabs root → `items-count` wrapper → Tab items
  if (kids.length === 1 && (kids[0]!.children?.length ?? 0) >= 2) {
    const nested = kids[0]!.children!.filter(isTabItemNode);
    if (nested.length >= 2) return nested;
  }

  // Mis-mapped siblings: each child already became Tabs
  const tabsKids = kids.filter((k) => k.componentRef?.component === 'Tabs');
  if (tabsKids.length >= 2 && tabsKids.length >= kids.length - 1) return tabsKids;

  return [];
}

function looksLikeTabsContainer(node: DesignNode): boolean {
  if (nodeNames(node).some(isTabsRootName)) return tabItemsUnder(node).length >= 2;
  return tabItemsUnder(node).length >= 2;
}

function stripTabsRef(node: DesignNode): DesignNode {
  if (node.componentRef?.component !== 'Tabs') return node;
  const { componentRef: _drop, ...rest } = node;
  return {
    ...rest,
    type: rest.type === 'instance' || rest.type === 'component' ? 'frame' : rest.type,
  };
}

function promoteTabsContainer(node: DesignNode): DesignNode {
  if (!looksLikeTabsContainer(node)) return node;
  if (node.componentRef?.component === 'Tabs') return node;

  // Flatten mis-mapped tab children back to plain nodes for label collection
  const children = node.children?.map((child) => {
    if (child.componentRef?.component === 'Tabs') return stripTabsRef(child);
    if ((child.children?.length ?? 0) >= 2 && tabItemsUnder(child).length >= 2) {
      return {
        ...child,
        children: child.children?.map((c) =>
          c.componentRef?.component === 'Tabs' ? stripTabsRef(c) : c,
        ),
      };
    }
    return child;
  });

  return {
    ...node,
    children,
    componentRef: {
      library: 'antd',
      importFrom: 'antd',
      component: 'Tabs',
      props: {},
    },
  };
}

function mapNode(node: DesignNode): DesignNode {
  const children = node.children?.map(mapNode);
  let current: DesignNode = children ? { ...node, children } : { ...node };

  if (node.type === 'instance' || node.type === 'component') {
    const ref = matchAntdComponent(node.name, node.mainComponentName);
    if (ref) {
      if (ref.component === 'Table' && !looksLikeFullTable(current)) {
        current = {
          ...current,
          type: 'frame',
          mainComponentName: node.mainComponentName,
        };
      } else if (ref.component === 'Tabs' && isTabItemNode(node)) {
        // Safety: never keep Tabs on a tab item
        current = {
          ...current,
          type: 'frame',
          mainComponentName: node.mainComponentName,
        };
      } else {
        current = { ...current, componentRef: ref };
      }
    }
  }

  return promoteTabsContainer(current);
}
