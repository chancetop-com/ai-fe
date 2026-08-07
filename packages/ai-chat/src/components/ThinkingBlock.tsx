import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Loader2 } from 'lucide-react';

export interface ThinkingBlockProps {
  thinking: string;
  isStreaming: boolean;
}

export function ThinkingBlock({ thinking, isStreaming }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(isStreaming);

  useEffect(() => {
    setExpanded(isStreaming);
  }, [isStreaming]);

  return (
    <div
      className="mb-2 rounded-xl border text-xs"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-bg-tertiary)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex items-center gap-1.5 w-full px-3 py-2 cursor-pointer"
        style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Brain size={14} />
        <span className="font-medium">Thinking</span>
        {isStreaming ? <Loader2 size={12} className="animate-spin ml-1" /> : null}
      </button>
      {expanded ? (
        <div className="px-3 pb-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <pre
            className="whitespace-pre-wrap font-mono opacity-70 leading-relaxed"
            style={{ color: 'var(--color-text-secondary)', fontSize: '11px', margin: 0 }}
          >
            {thinking || '(empty)'}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
