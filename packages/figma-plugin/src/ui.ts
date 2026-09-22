const formatSelect = document.getElementById('format') as HTMLSelectElement;
const stackSelect = document.getElementById('stack') as HTMLSelectElement;
const exportBtn = document.getElementById('export') as HTMLButtonElement;
const copyBtn = document.getElementById('copy') as HTMLButtonElement;
const output = document.getElementById('output') as HTMLTextAreaElement;
const meta = document.getElementById('meta') as HTMLDivElement;
const errorEl = document.getElementById('error') as HTMLDivElement;

let lastCode = '';
let currentBuild = '';

if (!formatSelect || !stackSelect || !exportBtn || !copyBtn || !output || !meta || !errorEl) {
  throw new Error('Plugin UI failed to mount: missing DOM elements');
}

function showError(message: string) {
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

exportBtn.onclick = () => {
  clearError();
  output.value = '正在导出…';
  parent.postMessage(
    {
      pluginMessage: {
        type: 'export',
        format: formatSelect.value as 'react' | 'html',
        stack: stackSelect.value as 'antd' | 'tailwind',
      },
    },
    '*',
  );
};

copyBtn.onclick = async () => {
  if (!lastCode) return;
  try {
    await navigator.clipboard.writeText(lastCode);
    copyBtn.textContent = '已复制';
    setTimeout(() => {
      copyBtn.textContent = '复制';
    }, 1200);
  } catch {
    showError('复制失败，请手动选择文本复制。');
  }
};

window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'ready') {
    currentBuild = msg.version ?? '';
    const v = currentBuild ? ` · build ${currentBuild}` : '';
    meta.textContent = `插件已就绪，请选中 Frame 后点击导出${v}`;
    return;
  }

  if (msg.type === 'error') {
    showError(msg.message);
    if (!lastCode) output.value = '';
    return;
  }

  if (msg.type === 'result') {
    clearError();
    currentBuild = msg.version ?? currentBuild;
    lastCode = msg.code;
    if (msg.format === 'html' && msg.auxiliary) {
      lastCode = `${msg.code}\n\n/* styles.css */\n${msg.auxiliary}`;
    }
    output.value = lastCode;
    copyBtn.disabled = false;
    const v = currentBuild ? ` · build ${currentBuild}` : '';
    meta.textContent = `${msg.meta?.name ?? ''} · node ${msg.meta?.figmaNodeId ?? ''}${v}`;
  }
};
