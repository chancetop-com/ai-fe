import { lazy, Suspense, useState } from 'react';
import { Loader2, ChevronDown, ChevronRight, Wrench, Copy, Check } from 'lucide-react';
import type { ToolEvent } from '../chat-state';
import { formatJson, getArgsPreview, normalizeArgs } from '../utils';

const JsonTreeView = lazy(() => import('./JsonTreeView'));

function tryParseJson(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const first = trimmed[0];
  if (first !== '{' && first !== '[' && first !== '"') return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function CopyIconButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.warn('copy failed', error);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ai-chat-ghost-btn"
      style={{
        color: copied ? 'var(--color-success)' : undefined,
        fontSize: '10px',
      }}
      title={copied ? 'Copied' : 'Copy detail'}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

function JsonResultView({ value }: { value: string }) {
  return (
    <Suspense
      fallback={
        <pre className="whitespace-pre-wrap font-mono px-3 py-2" style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
          Loading JSON...
        </pre>
      }
    >
      <JsonTreeView value={value} defaultExpandDepth={1} showHeader={false} />
    </Suspense>
  );
}

export function ToolsBlock({ tools, isStreaming = false }: { tools: ToolEvent[]; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [collapsedChildren, setCollapsedChildren] = useState<Set<string>>(new Set());

  if (tools.length === 0) return null;

  const toggleResult = (key: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleChildren = (key: string) => {
    setCollapsedChildren((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isSuccessful = (status?: string) => status === 'success' || status === 'COMPLETED';
  const isPending = (status?: string) =>
    status === 'pending' || status === 'PENDING' || status === 'async_launched';
  const doneCount = tools.filter(
    (tool) => tool.type === 'result' && (isSuccessful(tool.resultStatus) || isPending(tool.resultStatus))
  ).length;

  const buildTaskToolLabel = (tool: ToolEvent): string | null => {
    if (tool.tool !== 'task') return null;
    const args = normalizeArgs(tool.arguments);
    if (!args) return null;
    const subagentType = typeof args.subagent_type === 'string' ? args.subagent_type : null;
    if (!subagentType) return null;
    const model = tool.model;
    if (model && model !== subagentType) {
      return `task(${subagentType}[${model}])`;
    }
    return `task(${subagentType})`;
  };

  const isRunning = (tool: ToolEvent): boolean => {
    if (!isStreaming) return false;
    if (tool.type === 'start') return true;
    if (tool.children?.some(isRunning)) return true;
    return false;
  };

  const hasRunning = tools.some(isRunning);
  const toolDetail = (tool: ToolEvent): string | undefined => {
    if (tool.type === 'result' && tool.result) return tool.result;
    return tool.output;
  };

  const renderToolRow = (tool: ToolEvent, key: string, level = 0) => {
    const hasChildren = tool.children && tool.children.length > 0;
    const showTaskIdBadge = level === 0 && tool.taskId;
    const detail = toolDetail(tool);
    const headerContent = (
      <>
        {tool.type === 'start' && isStreaming ? (
          <Loader2 size={14} className="animate-spin shrink-0" style={{ color: 'var(--color-warning)' }} />
        ) : (
          <span
            className="shrink-0"
            style={{
              color: isSuccessful(tool.resultStatus)
                ? 'var(--color-success)'
                : isPending(tool.resultStatus)
                  ? 'var(--color-warning)'
                  : 'var(--color-error)',
            }}
          >
            {isSuccessful(tool.resultStatus) ? '\u2713' : isPending(tool.resultStatus) ? '\u2026' : '\u2717'}
          </span>
        )}
        <span
          className="font-mono font-medium truncate"
          style={{ color: hasChildren ? '#8b5cf6' : 'var(--color-primary)' }}
        >
          {buildTaskToolLabel(tool) ?? tool.tool}
        </span>
        {showTaskIdBadge ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono shrink-0 max-w-[200px] truncate"
            style={{
              background: tool.runInBackground ? 'var(--color-warning)' + '20' : '#8b5cf6' + '20',
              color: tool.runInBackground ? 'var(--color-warning)' : '#8b5cf6',
            }}
          >
            {tool.runInBackground ? <span className="opacity-70">bg:</span> : null}
            {tool.taskId}
          </span>
        ) : null}
        {hasChildren ? (
          <span className="text-xs opacity-60 shrink-0" style={{ color: '#8b5cf6' }}>
            ({tool.children!.length} sub-tools)
          </span>
        ) : null}
        {tool.arguments && normalizeArgs(tool.arguments) && getArgsPreview(tool.arguments) ? (
          <span className="opacity-70 truncate min-w-0">{getArgsPreview(tool.arguments)}</span>
        ) : null}
        {tool.type === 'result' ? (
          <>
            <span
              className="shrink-0"
              style={{
                color: isSuccessful(tool.resultStatus)
                  ? 'var(--color-success)'
                  : isPending(tool.resultStatus)
                    ? 'var(--color-warning)'
                    : 'var(--color-error)',
              }}
            >
              {isSuccessful(tool.resultStatus)
                ? 'done'
                : isPending(tool.resultStatus)
                  ? 'submitted'
                  : tool.resultStatus || 'error'}
            </span>
            {detail ? (
              <button
                type="button"
                onClick={() => toggleResult(key)}
                className="ai-chat-ghost-btn ml-auto shrink-0"
              >
                {expandedResults.has(key) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>detail</span>
              </button>
            ) : null}
          </>
        ) : null}
        {tool.type === 'start' && tool.output ? (
          <button type="button" onClick={() => toggleResult(key)} className="ai-chat-ghost-btn ml-auto shrink-0">
            {expandedResults.has(key) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>output</span>
          </button>
        ) : null}
      </>
    );

    if (!hasChildren) {
      return (
        <div key={key}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded"
            style={{
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-secondary)',
              marginLeft: level > 0 ? `${level * 12}px` : undefined,
            }}
          >
            {headerContent}
          </div>
          {detail && expandedResults.has(key) ? (
            <div className="px-3 pb-1.5" style={{ marginLeft: level > 0 ? `${level * 12}px` : undefined }}>
              <div
                className="relative rounded-b overflow-auto"
                style={{ maxHeight: '240px', background: 'var(--color-bg-secondary)' }}
              >
                <div className="absolute top-1 right-1 z-10">
                  <CopyIconButton text={formatJson(detail)} />
                </div>
                {tryParseJson(detail) !== null ? (
                  <JsonResultView value={detail} />
                ) : (
                  <pre
                    className="whitespace-pre-wrap font-mono px-3 py-2"
                    style={{ color: 'var(--color-text-secondary)', fontSize: '11px', margin: 0 }}
                  >
                    {detail}
                  </pre>
                )}
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    const childrenCollapsed = collapsedChildren.has(key);
    return (
      <div
        key={key}
        className="rounded-lg overflow-hidden"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          marginLeft: level > 0 ? `${level * 12}px` : undefined,
        }}
      >
        <button
          type="button"
          onClick={() => toggleChildren(key)}
          className="flex items-center gap-2 w-full text-left cursor-pointer"
          style={{
            padding: '6px 12px',
            color: 'var(--color-text-secondary)',
            background: 'var(--color-bg-tertiary)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {childrenCollapsed ? <ChevronRight size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
          <span className="flex items-center gap-2 flex-1 min-w-0">{headerContent}</span>
        </button>
        {detail && expandedResults.has(key) ? (
          <div
            className="relative"
            style={{ borderBottom: '1px solid var(--color-border)', maxHeight: '240px', overflow: 'auto' }}
          >
            <div className="absolute top-1 right-1 z-10">
              <CopyIconButton text={formatJson(detail)} />
            </div>
            {tryParseJson(detail) !== null ? (
              <JsonResultView value={detail} />
            ) : (
              <pre
                className="whitespace-pre-wrap font-mono px-3 py-2"
                style={{ color: 'var(--color-text-secondary)', fontSize: '11px', margin: 0 }}
              >
                {detail}
              </pre>
            )}
          </div>
        ) : null}
        {!childrenCollapsed ? (
          <div className="flex flex-col gap-1.5 p-2">
            {tool.children!.map((child, childIndex) => renderToolRow(child, `${key}-child-${childIndex}`, level + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className="mb-2 rounded-xl border text-xs"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-tertiary)' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="ai-chat-ghost-btn flex items-center gap-1.5 w-full justify-start px-3 py-2 rounded-none"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Wrench size={14} />
        {hasRunning ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--color-warning)' }} /> : null}
        <span className="font-medium">Tools ({tools.length})</span>
        {doneCount > 0 ? <span className="opacity-60">({doneCount} done)</span> : null}
      </button>
      {expanded ? (
        <div className="border-t flex flex-col gap-0" style={{ borderColor: 'var(--color-border)' }}>
          {tools.map((tool, index) => renderToolRow(tool, String(index), 0))}
        </div>
      ) : null}
    </div>
  );
}
