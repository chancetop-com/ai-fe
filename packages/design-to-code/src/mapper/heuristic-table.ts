import type { ComponentRef, DesignIR, DesignNode } from '../types/ir';

function antdRef(component: string, props: Record<string, unknown> = {}): ComponentRef {
  return {
    library: 'antd',
    importFrom: 'antd',
    component,
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

function nameMatchesTableColumn(node: DesignNode): boolean {
  const names = [node.name, node.mainComponentName].filter(Boolean) as string[];
  return names.some(
    (n) =>
      /^Table\s*Column\b/i.test(n) ||
      /^TableColumn\b/i.test(n) ||
      /\/Table\s*Column\b/i.test(n),
  );
}

export function isTableColumnNode(node: DesignNode): boolean {
  return nameMatchesTableColumn(node);
}

function slugKey(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
  return base ? `col_${index}_${base}` : `col_${index}`;
}

interface TableModel {
  columns: Array<{ title: string; dataIndex: string; key: string }>;
  dataSource: Array<Record<string, string>>;
}

function isBuiltTable(node: DesignNode): boolean {
  const ref = node.componentRef;
  return (
    !!ref &&
    ref.component === 'Table' &&
    Array.isArray(ref.props.columns) &&
    (ref.props.columns as unknown[]).length > 0
  );
}

/**
 * Column shell: direct children are Table Column *cells* (typically one text each).
 * Must NOT become its own <Table /> — only the parent multi-column frame should.
 */
function isColumnShell(node: DesignNode): boolean {
  const kids = node.children ?? [];
  if (kids.length < 2) return false;
  const cells = kids.filter(nameMatchesTableColumn);
  if (cells.length < 2 || cells.length < kids.length - 1) return false;
  // Cells usually hold a single label; full column components hold header + rows (≥2).
  const cellLike = cells.filter((c) => collectTexts(c).length <= 1);
  return cellLike.length >= Math.ceil(cells.length * 0.8);
}

/**
 * Extract column text lists from a table-level frame.
 *
 * Supported structures:
 * 1) Frame → [Table Column, …] where each column has header + cell texts (≥2)
 * 2) Frame → [ColFrame, …] where each ColFrame’s children are Table Column cells
 *
 * Does NOT promote a single column shell (cells as siblings) into a Table.
 */
function extractColumnTextLists(node: DesignNode): string[][] | null {
  const kids = node.children ?? [];
  if (kids.length < 2) return null;

  // Lone column shell → never a table
  if (isColumnShell(node)) return null;

  // Case 1: full column components (header + ≥1 cell text inside each)
  const fullColumns = kids.filter(
    (k) => nameMatchesTableColumn(k) && collectTexts(k).length >= 2,
  );
  if (fullColumns.length >= 2 && fullColumns.length >= kids.length - 1) {
    return fullColumns.map(collectTexts);
  }

  // Case 2: column wrappers whose children are Table Column cell instances
  const wrapped = kids
    .map((col) => {
      const cells = (col.children ?? []).filter(nameMatchesTableColumn);
      if (cells.length < 2) return null;
      // Keep empty strings so row/column alignment matches siblings (e.g. thumbnail col)
      return cells.map((c) => collectTexts(c)[0] ?? '');
    })
    .filter((t): t is string[] => t != null);

  if (wrapped.length >= 2 && wrapped.length >= kids.length - 1) {
    return wrapped;
  }

  return null;
}

/**
 * Safety net: siblings that were wrongly promoted as one-Table-per-column
 * (each Table’s column titles are actually cell labels, dataSource empty).
 */
function tryMergeMispromotedColumnTables(children: DesignNode[]): TableModel | null {
  if (children.length < 2) return null;
  const tables = children.filter(isBuiltTable);
  if (tables.length < 2 || tables.length < children.length - 1) return null;

  const lists: string[][] = [];
  for (const t of tables) {
    const cols = t.componentRef!.props.columns as Array<{ title?: string }>;
    const ds = t.componentRef!.props.dataSource as unknown[];
    // Mis-promoted column shells: many "columns", no/ few data rows
    if (!Array.isArray(cols) || cols.length < 2) return null;
    if (Array.isArray(ds) && ds.length > 0) return null;
    lists.push(cols.map((c) => (typeof c.title === 'string' ? c.title : '')));
  }

  return buildTableModel(lists);
}

function buildTableModel(textLists: string[][]): TableModel {
  const rowCount = Math.max(0, ...textLists.map((t) => Math.max(0, t.length - 1)));

  const usedKeys = new Set<string>();
  const colDefs = textLists.map((texts, index) => {
    const title = texts[0] || `Column ${index + 1}`;
    let key = slugKey(title, index);
    if (usedKeys.has(key)) key = `${key}_${index}`;
    usedKeys.add(key);
    return { title, dataIndex: key, key, texts };
  });

  const dataSource = Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: Record<string, string> = { key: String(rowIndex) };
    for (const col of colDefs) {
      row[col.dataIndex] = col.texts[rowIndex + 1] ?? '';
    }
    return row;
  });

  return {
    columns: colDefs.map(({ title, dataIndex, key }) => ({ title, dataIndex, key })),
    dataSource,
  };
}

function makeTableNode(id: string, model: TableModel): DesignNode {
  return {
    id: `${id}-table`,
    name: 'Table',
    type: 'instance',
    componentRef: antdRef('Table', {
      pagination: false,
      columns: model.columns,
      dataSource: model.dataSource,
    }),
  };
}

function isEmptyTableRef(node: DesignNode): boolean {
  const ref = node.componentRef;
  if (!ref || ref.component !== 'Table') return false;
  const hasColumns = Array.isArray(ref.props.columns) && ref.props.columns.length > 0;
  const hasData = Array.isArray(ref.props.dataSource) && ref.props.dataSource.length > 0;
  return !hasColumns && !hasData;
}

function stripEmptyTableRefs(node: DesignNode): DesignNode {
  const children = node.children?.map(stripEmptyTableRefs);
  const current: DesignNode = children ? { ...node, children } : { ...node };

  if (!isEmptyTableRef(current)) return current;

  const { componentRef: _drop, mainComponentName: _main, ...rest } = current;
  if (rest.type === 'instance' || rest.type === 'component') {
    rest.type = 'frame';
  }
  return rest;
}

function mapNode(node: DesignNode): DesignNode {
  const children = node.children?.map(mapNode);
  const current: DesignNode = children ? { ...node, children } : { ...node };

  if (isBuiltTable(current)) {
    return current;
  }

  // Merge siblings that were incorrectly turned into one Table per column
  if (current.children && current.children.length >= 2) {
    const merged = tryMergeMispromotedColumnTables(current.children);
    if (merged) {
      return makeTableNode(current.id, merged);
    }
  }

  const textLists = extractColumnTextLists(current);
  if (textLists && textLists.length >= 2) {
    return makeTableNode(current.id, buildTableModel(textLists));
  }

  return current;
}

/**
 * Designer table: frame with ≥2 "Table Column" columns → one antd Table.
 * Cell-level Table Column instances alone do not become tables.
 */
export function mapTableHeuristics(ir: DesignIR): DesignIR {
  const cleaned = stripEmptyTableRefs(ir.root);
  return { ...ir, root: mapNode(cleaned) };
}
