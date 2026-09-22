import type { ComponentRef, DesignIR, DesignNode } from '../types/ir';

function antdRef(
  component: string,
  props: Record<string, unknown> = {},
  subComponent?: string,
): ComponentRef {
  return {
    library: 'antd',
    importFrom: 'antd',
    component,
    subComponent,
    props,
  };
}

function textOf(node: DesignNode): string | undefined {
  if (node.type === 'text' && node.text?.characters.trim()) {
    return node.text.characters.trim();
  }
  return undefined;
}

function collectTexts(node: DesignNode): string[] {
  const t = textOf(node);
  if (t) return [t];
  return node.children?.flatMap(collectTexts) ?? [];
}

function isCounterText(text: string): boolean {
  return /^\d+\s*\/\s*\d+$/.test(text.trim());
}

function parseMaxLength(counter: string): number | undefined {
  const m = counter.trim().match(/^\d+\s*\/\s*(\d+)$/);
  return m ? Number(m[1]) : undefined;
}

function findCounter(texts: string[]): string | undefined {
  return texts.find(isCounterText);
}

/** Block picker chips in Campaign content (3×2 grid). */
const BLOCK_TYPES = new Set(['text', 'image', 'button', 'item', 'location', 'promotion']);

function isBlockTypeLabel(text: string): boolean {
  return BLOCK_TYPES.has(text.trim().toLowerCase());
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v || seen.has(v) || /^\+\d+$/.test(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function isFormItem(node: DesignNode): boolean {
  return node.componentRef?.component === 'Form' && node.componentRef.subComponent === 'Item';
}

function isFormRoot(node: DesignNode): boolean {
  return node.componentRef?.component === 'Form' && !node.componentRef.subComponent;
}

function countFormItems(node: DesignNode): number {
  let n = isFormItem(node) ? 1 : 0;
  for (const child of node.children ?? []) n += countFormItems(child);
  return n;
}

/**
 * Field labels only — not section chrome (Text/Image/Button/Item/Promotion)
 * and not bare "Location" (that is also a block chip).
 */
function isFieldLabelText(text: string): boolean {
  const t = text.trim();
  if (!t || isCounterText(t) || isBlockTypeLabel(t)) return false;

  if (/\*\s*$/.test(t) && t.length <= 64) {
    const bare = t.replace(/\s*\*$/, '').trim();
    // Block section titles (Text/Button/…) are not fields; Image * is the upload field
    if (isBlockTypeLabel(bare) && !/^blocks?$/i.test(bare) && !/^image$/i.test(bare)) {
      return false;
    }
    return true;
  }

  return /^(Type|Channels?|Locations?|Price|Name|Status|Customer|Campaign name|Scheduled send time|Headline|Description|Button label|Button color|Link|Layout)\s*$/i.test(
    t,
  );
}

function findFieldLabel(node: DesignNode): string | undefined {
  return collectTexts(node).find(isFieldLabelText);
}

function looksLikeBlockPicker(node: DesignNode): boolean {
  const texts = collectTexts(node).filter(
    (t) => !isCounterText(t) && !/^blocks?\s*\*?$/i.test(t),
  );
  const types = uniqueStrings(texts.filter(isBlockTypeLabel));
  if (types.length < 3) return false;
  // Picker nodes are almost only chip labels — not a whole page of fields
  const other = texts.filter((t) => !isBlockTypeLabel(t));
  return other.length === 0;
}

function collectBlockTypes(node: DesignNode): string[] {
  return uniqueStrings(collectTexts(node).filter(isBlockTypeLabel));
}

function findExistingControl(nodes: DesignNode[]): DesignNode | null {
  for (const n of nodes) {
    const c = n.componentRef?.component;
    if (
      c === 'DatePicker' ||
      c === 'TimePicker' ||
      c === 'Select' ||
      c === 'Input' ||
      c === 'Radio' ||
      c === 'Tabs' ||
      c === 'Switch'
    ) {
      return n;
    }
    if (n.children) {
      const nested = findExistingControl(n.children);
      if (nested) return nested;
    }
  }
  return null;
}

/** Page/section Tabs (Taxes / Payments / …) — not a Channels form field. */
function looksLikeNavTabs(nodes: DesignNode[]): boolean {
  if (nodes.some((n) => n.componentRef?.component === 'Tabs')) return true;
  const texts = nodes.flatMap(collectTexts);
  const navLike = texts.filter((t) =>
    /^(Taxes|Payments|Terms\s*&\s*Policies|Channels|Web Ordering|Mobile App Ordering|QR Code Ordering|Kiosk Ordering)$/i.test(
      t,
    ),
  );
  return navLike.length >= 2;
}

function looksLikePriceInput(node: DesignNode): { value: string } | null {
  const texts = collectTexts(node).filter((t) => t !== '$' && t !== '￥' && /^\d+(\.\d+)?$/.test(t));
  const symbols = collectTexts(node).filter((t) => t === '$' || t === '￥');
  if (!symbols.length || !texts[0]) return null;
  return { value: texts[0] };
}

function makeTagNode(label: string, index: number): DesignNode {
  return {
    id: `tag-${index}-${label}`,
    name: 'Tag',
    type: 'instance',
    componentRef: antdRef('Tag'),
    children: [{ id: `tag-txt-${index}`, name: 'text', type: 'text', text: { characters: label } }],
  };
}

function makeTagRow(labels: string[]): DesignNode {
  return {
    id: `tag-row-${labels.join('-').slice(0, 24)}`,
    name: 'TagRow',
    type: 'frame',
    layout: {
      mode: 'flex',
      direction: 'row',
      gap: 8,
      alignItems: 'CENTER',
      className: 'flex flex-row flex-wrap gap-2 items-center',
    },
    children: labels.map((label, i) => makeTagNode(label, i)),
  };
}

function makeSelect(
  options: string[],
  props: Record<string, unknown> = {},
): DesignNode {
  const unique = uniqueStrings(options);
  return {
    id: `select-${unique.join('-').slice(0, 32) || 'empty'}`,
    name: 'Select',
    type: 'instance',
    componentRef: antdRef('Select', {
      placeholder: 'Select',
      ...(unique.length ? { options: unique.map((label) => ({ label, value: label })) } : {}),
      className: 'w-full',
      ...props,
    }),
  };
}

function makeRadioGroup(options: string[]): DesignNode {
  return {
    id: `radio-${options.join('-').slice(0, 32)}`,
    name: 'Radio.Group',
    type: 'instance',
    componentRef: antdRef('Radio', { optionType: 'button' }, 'Group'),
    children: options.map((label, i) => ({
      id: `radio-opt-${i}`,
      name: label,
      type: 'instance',
      componentRef: antdRef('Radio', { value: label }),
      children: [{ id: `radio-txt-${i}`, name: 'text', type: 'text', text: { characters: label } }],
    })),
  };
}

function makeInput(props: Record<string, unknown>): DesignNode {
  const cleaned = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));
  return {
    id: `input-${String(cleaned.defaultValue ?? cleaned.placeholder ?? 'field').slice(0, 24)}`,
    name: 'Input',
    type: 'instance',
    componentRef: antdRef('Input', cleaned),
  };
}

function makeTextArea(props: Record<string, unknown>): DesignNode {
  const cleaned = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));
  return {
    id: `textarea-${String(cleaned.defaultValue ?? 'field').slice(0, 24)}`,
    name: 'Input.TextArea',
    type: 'instance',
    componentRef: antdRef('Input', cleaned, 'TextArea'),
  };
}

function makeSearch(placeholder: string): DesignNode {
  return {
    id: `search-${placeholder.slice(0, 24)}`,
    name: 'Input.Search',
    type: 'instance',
    componentRef: antdRef('Input', { placeholder, className: 'w-full' }, 'Search'),
  };
}

function makeAlert(message: string, type: 'info' | 'warning' = 'info'): DesignNode {
  return {
    id: `alert-${message.slice(0, 16)}`,
    name: 'Alert',
    type: 'instance',
    componentRef: antdRef('Alert', { type, showIcon: true, message }),
  };
}

function makeFormItem(label: string, control: DesignNode, extra?: string): DesignNode {
  const required = /\*\s*$/.test(label.trim());
  const cleanLabel = label.replace(/\s*\*$/, '').trim();
  const props: Record<string, unknown> = { label: cleanLabel };
  if (required) props.required = true;
  if (extra) props.extra = extra;

  return {
    id: `form-item-${cleanLabel}`,
    name: 'Form.Item',
    type: 'instance',
    componentRef: antdRef('Form', props, 'Item'),
    children: [control],
  };
}

function hasNestedLabeledFields(nodes: DesignNode[]): boolean {
  for (const child of nodes) {
    if (isFormItem(child) || isFormRoot(child)) return true;
    if (findFieldLabel(child) && (child.children?.length ?? 0) >= 2) {
      const texts = collectTexts(child);
      if (texts.some((t) => !isFieldLabelText(t) && !isCounterText(t) && !isBlockTypeLabel(t))) {
        return true;
      }
    }
    if (child.children && hasNestedLabeledFields(child.children)) return true;
  }
  return false;
}

function inferControl(label: string, controlNodes: DesignNode[]): DesignNode | null {
  if (!controlNodes.length) return null;

  const existing = findExistingControl(controlNodes);
  if (existing) return existing;

  const allTexts = controlNodes
    .flatMap(collectTexts)
    .filter((t) => t !== label && !isFieldLabelText(t) && !isCounterText(t));
  const counter = findCounter(controlNodes.flatMap(collectTexts));
  const maxLength = counter ? parseMaxLength(counter) : undefined;
  const selectedSummary = allTexts.find((t) => /\d+\s+\w+\s+selected/i.test(t));

  if (/^blocks?\b/i.test(label)) {
    const types = collectBlockTypes({ id: 'tmp', name: 'tmp', type: 'frame', children: controlNodes });
    if (types.length >= 2) return makeTagRow(types);
    return null;
  }

  if (/^price\b/i.test(label)) {
    for (const n of controlNodes) {
      const price = looksLikePriceInput(n);
      if (price) {
        return makeInput({ prefix: '$', defaultValue: price.value, placeholder: '0.00' });
      }
    }
  }

  if (/^type\b/i.test(label) && allTexts.length >= 2) {
    return makeRadioGroup(allTexts);
  }

  // Channels as page Tabs (Taxes / Payments / …) — keep Tabs, do not Tag-ify
  if (/^channels?\b/i.test(label) && looksLikeNavTabs(controlNodes)) {
    return findExistingControl(controlNodes);
  }

  if (/^channels?\b/i.test(label) && allTexts.length) {
    return makeTagRow(allTexts);
  }

  // Location multi-select (place names) — not the Blocks chip
  if (/^locations?\b/i.test(label)) {
    const places = uniqueStrings(allTexts.filter((t) => !isBlockTypeLabel(t)));
    if (places.length >= 1) return makeSelect(places, { mode: 'multiple' });
    return null;
  }

  if (/^layout\b/i.test(label)) {
    const value = allTexts[0];
    return makeSelect(value ? [value] : [], {
      defaultValue: value,
      placeholder: 'Select layout',
    });
  }

  // Image upload slot — design shows thumbnail, not a text input
  if (/^image\b/i.test(label)) {
    if (!allTexts.length || /^(main|image)$/i.test(allTexts[0] ?? '')) {
      return makeInput({ placeholder: 'Upload image', className: 'w-full' });
    }
  }

  if (/^button color\b/i.test(label)) {
    const color = allTexts.find((t) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t));
    return makeInput({ defaultValue: color, placeholder: '#000000', className: 'w-full' });
  }

  if (selectedSummary) {
    return makeSearch(selectedSummary);
  }

  if (/^(description|headline)\b/i.test(label) || (allTexts[0] && allTexts[0].length > 80)) {
    const value = allTexts[0];
    return makeTextArea({
      defaultValue: value,
      rows: value && value.length > 120 ? 4 : 3,
      ...(maxLength ? { maxLength, showCount: true } : {}),
      className: 'w-full',
    });
  }

  if (/^customer\b/i.test(label) || (allTexts[0] && /select|choose|pick/i.test(allTexts[0]))) {
    return makeSelect([], { placeholder: allTexts[0] ?? 'Select' });
  }

  if (
    allTexts.length <= 1 ||
    /^campaign name\b|^button label\b|^link\b/i.test(label)
  ) {
    return makeInput({
      defaultValue: allTexts[0],
      ...(maxLength ? { maxLength, showCount: true } : {}),
      className: 'w-full',
    });
  }

  if (allTexts.length >= 2) {
    return makeSelect(allTexts, { mode: 'multiple' });
  }

  return null;
}

function popHelperText(rest: DesignNode[]): string | undefined {
  if (rest.length < 2) return undefined;
  const last = rest[rest.length - 1];
  const t = last ? textOf(last) : undefined;
  if (!t || isCounterText(t) || isFieldLabelText(t)) return undefined;
  if (/enter|hint|optional|free/i.test(t)) {
    rest.pop();
    return t;
  }
  return undefined;
}

function mergeTrailingHelper(node: DesignNode): DesignNode {
  const kids = node.children;
  if (!kids || kids.length !== 2) return node;
  const [first, second] = kids;
  if (!first || !isFormItem(first)) return node;
  const helper = second ? textOf(second) : undefined;
  if (!helper || !first.componentRef) return node;
  return {
    ...first,
    componentRef: {
      ...first.componentRef,
      props: { ...first.componentRef.props, extra: helper },
    },
  };
}

/** Blocks * + 3×2 chip grid → Form.Item + Tags */
function transformBlocksPicker(node: DesignNode): DesignNode | null {
  const texts = collectTexts(node);
  const blocksLabel = texts.find((t) => /^blocks?\s*\*$/i.test(t));
  if (!blocksLabel && !looksLikeBlockPicker(node)) return null;

  const types = collectBlockTypes(node);
  if (types.length < 3) return null;

  // Whole node is just the grid (no "Blocks *" label on this node)
  if (!blocksLabel) {
    return makeTagRow(types);
  }

  return makeFormItem(blocksLabel, makeTagRow(types));
}

/** Location card: title + place chips → section title + Form.Item Select */
function transformLocationBlock(node: DesignNode): DesignNode | null {
  const kids = node.children ?? [];
  if (kids.length < 2) return null;
  const title =
    textOf(kids[0]!) ??
    (kids[0] && collectTexts(kids[0]).length === 1 ? collectTexts(kids[0])[0] : undefined);
  if (!title || !/^location$/i.test(title)) return null;
  if (hasNestedLabeledFields(kids.slice(1))) return null;

  const places = uniqueStrings(
    kids.slice(1).flatMap(collectTexts).filter((t) => !isBlockTypeLabel(t) && !isCounterText(t)),
  );
  if (places.length < 2) return null;

  const control = makeSelect(places, { mode: 'multiple' });
  const item: DesignNode = {
    id: `${node.id}-location-item`,
    name: 'Form.Item',
    type: 'instance',
    componentRef: antdRef('Form', {}, 'Item'),
    children: [control],
  };

  return { ...node, children: [kids[0]!, item] };
}

/** Promotion / Item card: "N selected" summary → Input.Search, keep cards/table */
function transformSelectedSearch(node: DesignNode): DesignNode | null {
  const kids = node.children ?? [];
  if (!kids.length) return null;
  let changed = false;
  const next = kids.map((child) => {
    const t = textOf(child) ?? (collectTexts(child).length === 1 ? collectTexts(child)[0] : undefined);
    if (t && /\d+\s+\w+\s+selected/i.test(t) && !child.componentRef) {
      changed = true;
      return makeSearch(t);
    }
    return child;
  });
  if (!changed) return null;
  return { ...node, children: next };
}

function transformFormField(node: DesignNode): DesignNode | null {
  const merged = mergeTrailingHelper(node);
  if (merged !== node) return merged;

  const onlyTexts = collectTexts(node).filter((t) => !isCounterText(t));
  if (onlyTexts.length === 1 && isBlockTypeLabel(onlyTexts[0]!)) return null;

  const blocks = transformBlocksPicker(node);
  if (blocks) return blocks;

  if (looksLikeBlockPicker(node)) return null;

  const locationBlock = transformLocationBlock(node);
  if (locationBlock) {
    const withSearch = transformSelectedSearch(locationBlock);
    return withSearch ?? locationBlock;
  }

  const label = findFieldLabel(node);
  if (!label || !node.children || node.children.length < 2) {
    return transformSelectedSearch(node);
  }

  // Do not wrap a Tabs nav in Form.Item just because one tab label is "Channels"
  if (/^channels?\b/i.test(label.replace(/\s*\*$/, '').trim()) && looksLikeNavTabs(node.children)) {
    return null;
  }

  const bare = label.replace(/\s*\*$/, '').trim();
  if (isBlockTypeLabel(bare) && !/^image$/i.test(bare) && hasNestedLabeledFields(node.children)) {
    return transformSelectedSearch(node);
  }

  const counter = findCounter(collectTexts(node));
  const rest = node.children.filter((child) => !collectTexts(child).includes(label));
  const restMeaningful = rest.filter((child) => {
    if (findExistingControl([child])) return true;
    return collectTexts(child).some((t) => !isCounterText(t));
  });
  if (!restMeaningful.length) return transformSelectedSearch(node);

  if (/^(item|promotion)\b/i.test(bare) && restMeaningful.some((c) => (c.children?.length ?? 0) > 1)) {
    return transformSelectedSearch(node);
  }

  const extra = popHelperText(restMeaningful);

  if (/^price\b/i.test(label) && restMeaningful[0] && findFieldLabel(restMeaningful[0]) === label) {
    const nested = transformFormField(restMeaningful[0]);
    if (nested?.componentRef) {
      if (extra && nested.componentRef) {
        nested.componentRef = {
          ...nested.componentRef,
          props: { ...nested.componentRef.props, extra },
        };
      }
      return nested;
    }
  }

  const control = inferControl(label, restMeaningful);
  if (!control) return transformSelectedSearch(node);

  if (
    counter &&
    control.componentRef?.component === 'Input' &&
    control.componentRef.props.maxLength == null &&
    !/^button color\b/i.test(label)
  ) {
    const maxLength = parseMaxLength(counter);
    if (maxLength) {
      control.componentRef = {
        ...control.componentRef,
        props: { ...control.componentRef.props, maxLength, showCount: true },
      };
    }
  }

  return makeFormItem(label, control, extra);
}

function flattenFormRoots(node: DesignNode): DesignNode {
  const children = node.children?.map(flattenFormRoots);
  if (!children) return node;
  return {
    ...node,
    children: children.flatMap((child) => (isFormRoot(child) ? (child.children ?? []) : [child])),
  };
}

function wrapRootInForm(node: DesignNode): DesignNode {
  const prepared = flattenFormRoots(node);
  if (isFormRoot(prepared) || countFormItems(prepared) < 2) return prepared;
  return {
    ...prepared,
    children: [
      {
        id: `${prepared.id}-form`,
        name: 'Form',
        type: 'instance',
        componentRef: antdRef('Form', { layout: 'vertical' }),
        children: prepared.children,
      },
    ],
  };
}

function transformIntro(node: DesignNode): DesignNode | null {
  const texts = collectTexts(node);
  if (texts.length !== 1) return null;
  const message = texts[0]!;
  if (!/default price|highest priority/i.test(message)) return null;
  if (findFieldLabel(node)) return null;
  return makeAlert(message, 'info');
}

function transformOverwritePanel(node: DesignNode): DesignNode | null {
  if (node.componentRef || node.type === 'text' || !node.children?.length) return null;
  if (node.children.some(isFormItem) || node.children.some((c) => findFieldLabel(c))) return null;

  const alertChild = node.children.find(
    (c) => c.componentRef?.component === 'Alert' && !c.children?.length,
  );
  const texts = collectTexts(node);
  const message =
    texts.find((t) => /already configured|will be overwritten/i.test(t)) ??
    (typeof alertChild?.componentRef?.props.message === 'string'
      ? alertChild.componentRef.props.message
      : undefined);
  if (!message || !/already configured|will be overwritten/i.test(message)) return null;

  const rest = node.children.filter((child) => {
    if (child === alertChild || child.componentRef?.component === 'Alert') return false;
    return !collectTexts(child).includes(message);
  });

  return {
    ...node,
    layout: {
      mode: 'flex',
      direction: 'column',
      gap: 16,
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
      className: 'flex flex-col gap-4 p-4',
    },
    children: [alertChild ?? makeAlert(message, 'info'), ...rest],
  };
}

function normalizeRootLayout(node: DesignNode): DesignNode {
  const className = node.layout?.className?.replace(/\bitems-end\b/g, 'items-start');
  const alignItems =
    node.layout?.alignItems === 'MAX' || node.layout?.alignItems === 'items-end'
      ? 'MIN'
      : node.layout?.alignItems;
  if (
    (!className || className === node.layout?.className) &&
    alignItems === node.layout?.alignItems
  ) {
    return node;
  }
  return {
    ...node,
    layout: {
      ...(node.layout ?? { mode: 'flex' }),
      ...(className ? { className } : {}),
      ...(alignItems ? { alignItems } : {}),
    },
  };
}

function mapNode(node: DesignNode): DesignNode {
  // Resolve Blocks picker on the original tree so Location chips aren't turned into Form.Items first
  if (collectTexts(node).some((t) => /^blocks?\s*\*$/i.test(t)) && looksLikeBlockPicker(node)) {
    const blocks = transformBlocksPicker(node);
    if (blocks) return blocks;
  }
  if (looksLikeBlockPicker(node) && !findFieldLabel(node)) {
    return transformBlocksPicker(node) ?? node;
  }

  const children = node.children?.map(mapNode);
  const current: DesignNode = children ? { ...node, children } : { ...node };

  const intro = transformIntro(current);
  if (intro) return intro;

  const panel = transformOverwritePanel(current);
  if (panel) return panel;

  const field = transformFormField(current);
  if (field) return field;

  return current;
}

/** Heuristic upgrades for form-like frames (works without Figma edit access). */
export function mapFormHeuristics(ir: DesignIR): DesignIR {
  return { ...ir, root: wrapRootInForm(normalizeRootLayout(mapNode(ir.root))) };
}
