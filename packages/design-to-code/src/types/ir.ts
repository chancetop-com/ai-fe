/** Target UI stack for codegen */
export type OutputStack = 'antd' | 'tailwind';

export type DesignNodeType =
  | 'frame'
  | 'text'
  | 'image'
  | 'component'
  | 'instance'
  | 'group';

export type LayoutMode = 'flex' | 'absolute' | 'none';

export type FlexDirection = 'row' | 'column';

export interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Layout {
  mode: LayoutMode;
  direction?: FlexDirection;
  gap?: number;
  padding?: Box;
  alignItems?: string;
  justifyContent?: string;
  /** Tailwind utility classes derived from layout (computed by parser) */
  className?: string;
}

export interface NodeStyle {
  width?: number | 'fill' | 'hug';
  height?: number | 'fill' | 'hug';
  backgroundColor?: string;
  borderRadius?: number;
  opacity?: number;
  className?: string;
}

export interface TextContent {
  characters: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  className?: string;
}

export interface ComponentRef {
  library: 'antd';
  importFrom: 'antd';
  component: string;
  /** e.g. Input.Search → component=Input, subComponent=Search */
  subComponent?: string;
  props: Record<string, unknown>;
}

export interface DesignNode {
  id: string;
  name: string;
  type: DesignNodeType;
  layout?: Layout;
  style?: NodeStyle;
  text?: TextContent;
  /** Set when INSTANCE matches antd registry */
  componentRef?: ComponentRef;
  /** Figma main component name for instances */
  mainComponentName?: string;
  children?: DesignNode[];
}

export interface DesignIR {
  version: 1;
  stack: OutputStack;
  meta: {
    name: string;
    figmaFileKey?: string;
    figmaNodeId?: string;
    width?: number;
    height?: number;
  };
  root: DesignNode;
}

export type OutputFormat = 'react' | 'html';

export interface GenerateOptions {
  stack: OutputStack;
  format: OutputFormat;
  /** Export function name for React View component */
  viewName?: string;
}

export interface GenerateResult {
  code: string;
  auxiliary?: string;
  imports: string[];
}
