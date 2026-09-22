import type { Box, DesignIR, DesignNode, Layout } from '@connexup/design-to-code';
import { layoutToTailwind } from '@connexup/design-to-code';

const CONNEXUP_ADMIN_FILE_KEY = 'bXm7dRd8TmCl94bBJTWj1B';

function isLayoutFrame(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode {
  return (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE' ||
    node.type === 'GROUP'
  );
}

function extractPadding(node: FrameNode | ComponentNode | InstanceNode): Box | undefined {
  if (!('paddingTop' in node) || node.layoutMode === 'NONE') return undefined;
  return {
    top: node.paddingTop,
    right: node.paddingRight,
    bottom: node.paddingBottom,
    left: node.paddingLeft,
  };
}

function extractLayout(node: FrameNode | ComponentNode | InstanceNode): Layout | undefined {
  if (!('layoutMode' in node) || node.layoutMode === 'NONE') {
    return { mode: 'none' };
  }

  const layout: Layout = {
    mode: 'flex',
    direction: node.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
    gap: node.itemSpacing,
    padding: extractPadding(node),
    alignItems: node.counterAxisAlignItems,
    justifyContent: node.primaryAxisAlignItems,
  };
  layout.className = layoutToTailwind(layout);
  return layout;
}

function mapNodeType(node: SceneNode): DesignNode['type'] {
  switch (node.type) {
    case 'TEXT':
      return 'text';
    case 'INSTANCE':
      return 'instance';
    case 'COMPONENT':
      return 'component';
    case 'GROUP':
      return 'group';
    default:
      return 'frame';
  }
}

function parseText(node: TextNode): DesignNode {
  return {
    id: node.id,
    name: node.name,
    type: 'text',
    text: {
      characters: node.characters,
      fontSize: typeof node.fontSize === 'number' ? node.fontSize : undefined,
      fontWeight: typeof node.fontWeight === 'number' ? node.fontWeight : undefined,
      textAlign: mapTextAlign(node.textAlignHorizontal),
    },
  };
}

function mapTextAlign(
  align: TextNode['textAlignHorizontal'],
): 'left' | 'center' | 'right' | undefined {
  if (align === 'CENTER') return 'center';
  if (align === 'RIGHT') return 'right';
  if (align === 'LEFT') return 'left';
  return undefined;
}

function isDecorativeNode(node: SceneNode): boolean {
  return (
    node.type === 'VECTOR' ||
    node.type === 'LINE' ||
    node.type === 'ELLIPSE' ||
    node.type === 'STAR' ||
    node.type === 'POLYGON' ||
    node.type === 'BOOLEAN_OPERATION'
  );
}

function instanceHasText(node: InstanceNode): boolean {
  return node.findOne((n) => n.type === 'TEXT') != null;
}

async function parseChildren(node: SceneNode & ChildrenMixin): Promise<DesignNode[]> {
  const visible = node.children.filter((child) => child.visible);
  const parsed = await Promise.all(visible.map((child) => parseSceneNodeAsync(child)));
  return parsed.filter((child): child is DesignNode => child != null);
}

async function parseSceneNodeAsync(node: SceneNode): Promise<DesignNode | null> {
  if (isDecorativeNode(node)) {
    return null;
  }

  if (node.type === 'TEXT') {
    return parseText(node);
  }

  if (node.type === 'INSTANCE') {
    const w = node.width;
    const h = node.height;
    if (w <= 32 && h <= 32 && !instanceHasText(node)) {
      return null;
    }
  }

  const base: DesignNode = {
    id: node.id,
    name: node.name,
    type: mapNodeType(node),
  };

  if (node.type === 'INSTANCE') {
    const mainComponent = await node.getMainComponentAsync();
    base.mainComponentName = mainComponent?.name;
  }

  if (isLayoutFrame(node)) {
    const layout = extractLayout(node);
    if (layout) base.layout = layout;
    if ('children' in node && node.children.length > 0) {
      base.children = await parseChildren(node);
    }
    return base;
  }

  if ('children' in node && node.children.length > 0) {
    base.children = await parseChildren(node);
  }

  return base;
}

export async function parseSelectionAsync(
  node: SceneNode,
  fileKey = CONNEXUP_ADMIN_FILE_KEY,
): Promise<DesignIR> {
  const root = await parseSceneNodeAsync(node);
  const width = 'width' in node ? node.width : undefined;
  const height = 'height' in node ? node.height : undefined;

  return {
    version: 1,
    stack: 'antd',
    meta: {
      name: node.name,
      figmaFileKey: fileKey,
      figmaNodeId: node.id,
      width,
      height,
    },
    root:
      root ??
      ({
        id: node.id,
        name: node.name,
        type: 'frame',
      } satisfies DesignNode),
  };
}
