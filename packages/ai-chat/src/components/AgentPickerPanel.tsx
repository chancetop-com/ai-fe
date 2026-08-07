import { memo, useEffect, useMemo, useState } from 'react';
import type { AgentDefinition } from '@connexup/ai-api';
import { Bot, Check, Loader2, Search, Star } from 'lucide-react';

export interface AgentPickerPanelProps {
  agents: AgentDefinition[];
  selectedAgentId?: string;
  loading?: boolean;
  onSelectAgent: (id: string, agent?: AgentDefinition) => void;
  onSearchAgents?: (query: string) => Promise<AgentDefinition[]>;
}

function canChatWithAgent(agent: AgentDefinition): boolean {
  return agent.status === 'PUBLISHED' || agent.type === 'local';
}

export const AgentPickerPanel = memo(function AgentPickerPanel({
  agents,
  selectedAgentId = '',
  loading = false,
  onSelectAgent,
  onSearchAgents,
}: AgentPickerPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedAgents, setSearchedAgents] = useState<AgentDefinition[]>([]);

  const defaultAgents = useMemo(
    () => agents.filter((agent) => agent.system_default && canChatWithAgent(agent)),
    [agents]
  );
  const ownedAgents = useMemo(
    () => agents.filter((agent) => !agent.system_default && canChatWithAgent(agent)),
    [agents]
  );

  useEffect(() => {
    if (!searchQuery.trim() || !onSearchAgents) {
      setSearchedAgents([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void onSearchAgents(searchQuery.trim())
        .then((results) => {
          if (!cancelled) setSearchedAgents(results);
        })
        .catch(() => {
          if (!cancelled) setSearchedAgents([]);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [onSearchAgents, searchQuery]);

  const handleSelect = (id: string, agent?: AgentDefinition) => {
    onSelectAgent(id, agent);
    setSearchQuery('');
    setSearchedAgents([]);
  };

  const renderAgentButton = (agent: AgentDefinition, icon: 'bot' | 'star') => (
    <button
      key={agent.id}
      type="button"
      onClick={() => handleSelect(agent.id, agent)}
      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-left cursor-pointer"
      style={{
        background: selectedAgentId === agent.id ? 'var(--color-bg-tertiary)' : 'transparent',
        color: 'var(--color-text)',
        border: 'none',
      }}
    >
      {icon === 'bot' ? (
        <Bot size={14} style={{ color: 'var(--color-primary)' }} />
      ) : (
        <Star size={14} style={{ color: 'var(--color-text-secondary)' }} />
      )}
      <span className="flex-1 truncate">{agent.name}</span>
      {icon === 'star' && agent.created_by ? (
        <span className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
          {agent.created_by}
        </span>
      ) : null}
      {selectedAgentId === agent.id ? <Check size={14} style={{ color: 'var(--color-primary)' }} /> : null}
    </button>
  );

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-12 text-sm"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <Loader2 size={18} className="animate-spin" />
        Loading agents...
      </div>
    );
  }

  const hasAgents = defaultAgents.length > 0 || ownedAgents.length > 0 || Boolean(onSearchAgents);

  if (!hasAgents) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        No agents available
      </div>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-auto">
      {defaultAgents.length > 0 ? (
        <div className="p-2">
          <div
            className="flex items-center gap-2 px-2 py-1 text-xs font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Bot size={12} /> Default
          </div>
          {defaultAgents.map((agent) => renderAgentButton(agent, 'bot'))}
        </div>
      ) : null}

      {ownedAgents.length > 0 ? (
        <div className="p-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div
            className="flex items-center gap-2 px-2 py-1 text-xs font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Bot size={12} /> My Agents
          </div>
          {ownedAgents.map((agent) => renderAgentButton(agent, 'bot'))}
        </div>
      ) : null}

      {onSearchAgents ? (
        <div className="p-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div
            className="flex items-center gap-2 px-2 py-1 text-xs font-medium mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Star size={12} /> Shared Agents
          </div>
          <div className="relative mb-1">
            <Search
              size={12}
              className="absolute"
              style={{
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-secondary)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search shared agents..."
              className="w-full pl-7 pr-2 py-1.5 rounded-lg border text-xs outline-none"
              style={{
                background: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>
          {searchQuery.length > 0 ? (
            <div>
              {searchedAgents.length === 0 ? (
                <div className="text-center py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  No agents found
                </div>
              ) : (
                searchedAgents.map((agent) => renderAgentButton(agent, 'star'))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
