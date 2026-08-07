import { memo, useEffect, useRef, useState } from 'react';
import type { AgentDefinition } from '@connexup/ai-api';
import { Bot, ChevronDown } from 'lucide-react';
import { AgentPickerPanel } from './AgentPickerPanel';

export interface AgentSelectorProps {
  disabled?: boolean;
  agents: AgentDefinition[];
  selectedAgentId: string;
  selectedAgent?: AgentDefinition;
  onSelectAgent: (id: string, agent?: AgentDefinition) => void;
  onSearchAgents?: (query: string) => Promise<AgentDefinition[]>;
}

export const AgentSelector = memo(function AgentSelector({
  disabled = false,
  agents,
  selectedAgentId,
  selectedAgent,
  onSelectAgent,
  onSearchAgents,
}: AgentSelectorProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const dropdown = dropdownRef.current;
      const target = event.target as Node | null;
      if (!dropdown || !target) return;
      if (!dropdown.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  const handleSelect = (id: string, agent?: AgentDefinition) => {
    onSelectAgent(id, agent);
    setOpen(false);
  };

  return (
    <div
      className="border-b px-6 py-3 flex items-center justify-between"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-bg-secondary)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            disabled={disabled}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer disabled:opacity-40"
            style={{
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            <Bot size={14} style={{ color: 'var(--color-primary)' }} />
            <span className="truncate max-w-[160px]">{selectedAgent?.name || 'Select Agent'}</span>
            <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
          </button>

          {open ? (
            <div
              className="absolute left-0 top-11 z-50 w-[380px] rounded-xl border shadow-lg overflow-hidden"
              style={{
                background: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
              }}
            >
              <AgentPickerPanel
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelectAgent={handleSelect}
                onSearchAgents={onSearchAgents}
              />
            </div>
          ) : null}
        </div>

        {selectedAgent ? (
          <span className="flex-1 min-w-0 text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {selectedAgent.model || 'default model'}
            {selectedAgent.description ? ` · ${selectedAgent.description}` : ''}
          </span>
        ) : null}
      </div>
    </div>
  );
});
