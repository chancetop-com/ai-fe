import { useState } from 'react';
import { ChevronDown, ChevronRight, Box, Loader2 } from 'lucide-react';

export interface SandboxBlockProps {
  sandboxType?: string;
  sandboxId?: string;
  message: string;
  durationMs?: number;
}

export function SandboxBlock({ sandboxType, message, durationMs }: SandboxBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isPending = sandboxType === 'creating' || sandboxType === 'replacing';

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
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Box size={14} />}
        <span className="font-medium truncate">{message}</span>
        {durationMs != null ? <span style={{ color: 'var(--color-text-muted)' }}>{durationMs}ms</span> : null}
      </button>
      {expanded ? (
        <div className="px-3 pb-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div
            className="flex flex-col gap-1 pt-1.5 font-mono"
            style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}
          >
            {sandboxType ? <div>Type: {sandboxType}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
