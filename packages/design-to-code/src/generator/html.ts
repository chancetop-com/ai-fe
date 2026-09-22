import type { DesignIR, DesignNode, GenerateOptions, GenerateResult } from '../types/ir';
import { mergeClassNames } from '../utils/tailwind';

function renderHtmlNode(node: DesignNode, depth: number): string {
  const indent = '  '.repeat(depth);

  if (node.type === 'text' && node.text) {
    const text = node.text.characters.replace(/\n/g, ' ').trim();
    const className = mergeClassNames(node.text.className, node.style?.className);
    if (className) {
      return `${indent}<span class="${className}">${text}</span>`;
    }
    return `${indent}<span>${text}</span>`;
  }

  if (node.componentRef) {
    const className = antdApproxClass(node.componentRef);
    const children = node.children?.map((c) => renderHtmlNode(c, depth + 1)).join('\n');
    const label = node.children?.find((c) => c.type === 'text')?.text?.characters?.trim() ?? '';
    if (children) {
      return `${indent}<div class="${className}">\n${children}\n${indent}</div>`;
    }
    return `${indent}<button class="${className}">${label || node.name}</button>`;
  }

  const className = mergeClassNames(node.layout?.className, node.style?.className);
  const children = node.children?.map((c) => renderHtmlNode(c, depth + 1)).join('\n');
  if (!children) return '';
  if (className) {
    return `${indent}<div class="${className}">\n${children}\n${indent}</div>`;
  }
  return `${indent}<div>\n${children}\n${indent}</div>`;
}

function antdApproxClass(ref: DesignNode['componentRef']): string {
  if (!ref) return '';
  if (ref.component === 'Button') {
    if (ref.props.type === 'primary') return 'ant-btn ant-btn-primary';
    if (ref.props.danger) return 'ant-btn ant-btn-dangerous';
    return 'ant-btn';
  }
  if (ref.component === 'Input') return 'ant-input';
  if (ref.component === 'Card') return 'ant-card';
  return 'ant-component';
}

export function generateHtml(ir: DesignIR, _options: GenerateOptions): GenerateResult {
  const body = renderHtmlNode(ir.root, 2);
  const title = ir.meta.name;

  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="https://unpkg.com/antd/dist/reset.css" />
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
${body}
</body>
</html>
`;

  const auxiliary = `/* Tailwind-like layout utilities for preview */
.flex { display: flex; }
.flex-row { flex-direction: row; }
.flex-col { flex-direction: column; }
.gap-1 { gap: 4px; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-4 { gap: 16px; }
.gap-6 { gap: 24px; }
.p-4 { padding: 16px; }
.p-6 { padding: 24px; }
.px-4 { padding-left: 16px; padding-right: 16px; }
.py-4 { padding-top: 16px; padding-bottom: 16px; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
`;

  return { code, auxiliary, imports: [] };
}
