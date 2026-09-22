import { generate } from '@connexup/design-to-code';
import { parseSelectionAsync } from './parse-figma';

const BUILD_VERSION = '__BUILD_VERSION__';

try {
  figma.showUI('__REPLACE_UI_HTML__', {
    width: 520,
    height: 640,
    themeColors: true,
  });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  figma.notify(`插件 UI 加载失败: ${message}`, { error: true });
  throw err;
}

type UiMessage =
  | { type: 'export'; format: 'react' | 'html'; stack?: 'antd' | 'tailwind' }
  | { type: 'cancel' };

figma.ui.onmessage = async (msg: UiMessage) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }

  if (msg.type === 'export') {
    try {
      await figma.loadAllPagesAsync();

      const selection = figma.currentPage.selection;
      if (selection.length !== 1) {
        figma.ui.postMessage({
          type: 'error',
          message: '请在画布上选择一个 Frame（或 Component Instance）。',
        });
        return;
      }

      const node = selection[0];
      if (!node) {
        figma.ui.postMessage({ type: 'error', message: '未选中任何节点。' });
        return;
      }
      if (!('visible' in node) || !node.visible) {
        figma.ui.postMessage({ type: 'error', message: '所选节点不可见。' });
        return;
      }

      const ir = await parseSelectionAsync(node);
      const stack = msg.stack ?? 'antd';
      const result = generate(ir, {
        stack,
        format: msg.format,
      });
      figma.ui.postMessage({
        type: 'result',
        format: msg.format,
        code: result.code,
        auxiliary: result.auxiliary,
        meta: ir.meta,
        version: BUILD_VERSION,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      figma.ui.postMessage({ type: 'error', message });
    }
  }
};

figma.ui.postMessage({ type: 'ready', version: BUILD_VERSION });

if (figma.editorType === 'dev') {
  figma.notify(`Connex 插件已在 Dev Mode 启动 (${BUILD_VERSION})`, { timeout: 2500 });
}
