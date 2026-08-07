import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AgentDefinition, CreateSessionRequest } from '@connexup/ai-api';
import { StreamStatusEnum } from '@connexup/ai-api';
import { useAgentApi, useBlobApi, useFileApi } from '@connexup/ai-react';
import { toSendMessageAttachments } from './attachment-utils';
import { AgentSelector } from './components/AgentSelector';
import { ChatComposer, type ChatComposerHandle, type ComposerAttachment } from './components/ChatComposer';
import { ChatMessagesPanel } from './components/ChatMessagesPanel';
import { ChatSessionsSidebar } from './components/ChatSessionsSidebar';
import { MessageHost } from './components/MessageHost';
import type { ArtifactSpec } from './components/artifactTypes';
import { message } from './message';
import { formatApiError } from './utils';
import { UseAiChatOptions, useAiChat } from './useAiChat';

const ArtifactDrawer = lazy(() =>
  import('./components/ArtifactDrawer').then((module) => ({
    default: module.ArtifactDrawer,
  }))
);

export interface AiChatProps extends UseAiChatOptions {
  accessAgents: AgentDefinition[];
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  title?: string;
  showConnectionControls?: boolean;
  showSessionSidebar?: boolean;
  showAgentSelector?: boolean;
  onSend?: (message: string, attachments?: ComposerAttachment[]) => void | Promise<void>;
  onApprove?: (callId: string, approved: boolean) => void | Promise<void>;
}

function streamStatusLabel(status: StreamStatusEnum) {
  switch (status) {
    case StreamStatusEnum.OPEN:
      return {
        text: 'streaming',
        className: 'ai-chat-status-tag ai-chat-status-tag--success',
      };
    case StreamStatusEnum.CONNECTING:
      return {
        text: 'connecting',
        className: 'ai-chat-status-tag ai-chat-status-tag--warning',
      };
    case StreamStatusEnum.ERROR:
      return {
        text: 'error',
        className: 'ai-chat-status-tag ai-chat-status-tag--error',
      };
    case StreamStatusEnum.CLOSED:
      return { text: 'closed', className: 'ai-chat-status-tag' };
    default:
      return { text: 'idle', className: 'ai-chat-status-tag' };
  }
}

function sessionStatusLabel(status: string | null) {
  if (!status) return { text: 'session: unknown', className: 'ai-chat-status-tag' };
  if (status === 'running') {
    return {
      text: 'session: running',
      className: 'ai-chat-status-tag ai-chat-status-tag--warning',
    };
  }
  if (status === 'error') {
    return {
      text: 'session: error',
      className: 'ai-chat-status-tag ai-chat-status-tag--error',
    };
  }
  return { text: `session: ${status}`, className: 'ai-chat-status-tag' };
}

export function AiChat({
  accessAgents: allAgents,
  autoCreateSession = false,
  createSessionRequest,
  loadHistoryOnConnect = false,
  className,
  style,
  placeholder = 'Send a message...',
  title = 'AI Chat',
  showConnectionControls = false,
  showSessionSidebar = true,
  showAgentSelector = true,
  onSend,
  onApprove,
  refreshApiKey,
  baseUrl,
  apiKey,
  ...aiChatOptions
}: AiChatProps) {
  const {
    chatState,
    sessionId,
    sessionArtifacts,
    selectedAgentId,
    setSelectedAgentId,
    draftSession,
    chatSessions,
    setChatSessions,
    chatSessionsTotal,
    setChatSessionsTotal,
    chatSessionsLoading,
    chatSessionsLoadingMore,
    loadMoreChatSessions,
    activeSidebarSessionId,
    disconnect,
    sendMessage,
    approveToolCall,
    cancelTurn,
    closeSession,
    createSession,
    startNewChat,
    openChatSession,
    selectAgent,
    resolveDraftSession,
    handleSessionDeleted,
    renameChatSession,
    deleteChatSession,
    batchDeleteChatSessions,
  } = useAiChat({
    ...aiChatOptions,
    baseUrl,
    apiKey,
    refreshApiKey,
    autoCreateSession,
    createSessionRequest,
    loadHistoryOnConnect,
  });

  // const agentApi = useAgentApi({ baseUrl, apiKey });
  const blobApi = useBlobApi({ baseUrl: baseUrl ?? '', apiKey });
  const fileApi = useFileApi({ baseUrl: baseUrl ?? '', apiKey });
  // const [agents, setAgents] = useState<AgentDefinition[]>([]);
  // const [extraAgents, setExtraAgents] = useState<AgentDefinition[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactSpec | null>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // useEffect(() => {
  //   if (!showAgentSelector) return;
  //   void agentApi
  //     .listAgents({ my: true, includeSystemDefault: true })
  //     .then((response) => {
  //       const chatAgents = (response.agents || []).filter(
  //         (agent) => agent.status === 'PUBLISHED' || agent.type === 'local'
  //       );
  //       setAgents(chatAgents);
  //       if (!selectedAgentId && chatAgents[0]) {
  //         setSelectedAgentId(chatAgents[0].id);
  //       }
  //     })
  //     .catch((error) => {
  //       console.warn('failed to load agents', error);
  //     });
  // }, [agentApi, selectedAgentId, setSelectedAgentId, showAgentSelector]);

  // useEffect(() => {
  //   if (allAgents.length > 0) {
  //     if (createSessionRequest?.agent_id) {
  //       const agent = allAgents.find((agent) => agent.id === createSessionRequest.agent_id);
  //       if (agent) {
  //         setSelectedAgentId(agent.id);
  //       }
  //     } else {
  //       if (!selectedAgentId && allAgents[0]) {
  //         setSelectedAgentId(allAgents[0].id);
  //       }
  //     }
  //   }
  // }, [allAgents, createSessionRequest, selectedAgentId, setSelectedAgentId]);

  // const allAgents = useMemo(() => {
  //   const map = new Map<string, AgentDefinition>();
  //   for (const agent of [...agents, ...extraAgents]) {
  //     map.set(agent.id, agent);
  //   }
  //   return Array.from(map.values());
  // }, [agents, extraAgents]);

  const selectedAgent = useMemo(
    () => allAgents.find((agent) => agent.id === selectedAgentId),
    [allAgents, selectedAgentId]
  );

  // const searchAgents = useCallback(
  //   async (query: string) => {
  //     const response = await agentApi.listAgents({
  //       my: false,
  //       query,
  //       limit: 20,
  //     });
  //     return (response.agents || []).filter((agent) => agent.status === 'PUBLISHED' || agent.type === 'local');
  //   },
  //   [agentApi]
  // );

  const isTurnInProgress =
    chatState.sessionStatus === 'running' || chatState.streamStatus === StreamStatusEnum.CONNECTING;

  const hasOpenStream =
    chatState.streamStatus === StreamStatusEnum.OPEN ||
    chatState.streamStatus === StreamStatusEnum.CONNECTING ||
    chatState.sessionStatus === 'running';

  const isThinking = chatState.isThinking;

  const streamTag = streamStatusLabel(chatState.streamStatus);
  const sessionTag = sessionStatusLabel(chatState.sessionStatus);

  const openArtifact = useCallback((spec: ArtifactSpec) => {
    setActiveArtifact(spec);
  }, []);

  const handleApprove = async (callId: string, approved: boolean) => {
    try {
      if (onApprove) {
        await onApprove(callId, approved);
        return;
      }
      await approveToolCall(callId, approved);
    } catch (error) {
      message.error(formatApiError(error, 'Failed to approve tool call'));
    }
  };

  const handleSubmit = async (value: string, attachments?: ComposerAttachment[]) => {
    const trimmed = value.trim();
    const mappedAttachments = attachments?.length ? toSendMessageAttachments(attachments) : undefined;
    const hasAttachments = Boolean(mappedAttachments?.length);
    if (!trimmed && !hasAttachments) return;
    if (!selectedAgentId) {
      message.warning('Please select an agent first');
      return;
    }

    setActionLoading(true);
    try {
      if (onSend) {
        await onSend(trimmed, attachments);
      } else {
        await sendMessage(trimmed, undefined, mappedAttachments);
      }
    } catch (error) {
      message.error(formatApiError(error, 'Failed to send message'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSession = async (request?: CreateSessionRequest) => {
    setActionLoading(true);
    try {
      const created = await createSession(request ?? createSessionRequest ?? {});
      message.success(`Session created: ${created.sessionId}`);
    } catch (error) {
      message.error(formatApiError(error, 'Failed to create session'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelTurn = async () => {
    setActionLoading(true);
    try {
      await cancelTurn();
      disconnect();
      message.success('Turn cancelled');
    } catch (error) {
      message.error(formatApiError(error, 'Failed to cancel turn'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseSession = async () => {
    setActionLoading(true);
    try {
      await closeSession();
      message.success('Session closed');
    } catch (error) {
      message.error(formatApiError(error, 'Failed to close session'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectAgent = (agentId: string, agent?: AgentDefinition) => {
    // if (agent && !allAgents.find((item) => item.id === agent.id)) {
    //   setExtraAgents((prev) => [...prev, agent]);
    // }
    setActiveArtifact(null);
    void selectAgent(agentId);
  };

  const handleNewChat = () => {
    setActiveArtifact(null);
    startNewChat();
  };

  const handleOpenSession = (session: Parameters<typeof openChatSession>[0]) => {
    setActiveArtifact(null);
    void openChatSession(session);
  };

  return !allAgents.length ? (
    <div className="ai-chat ai-chat--no-agents flex flex-col items-center justify-center h-full gap-3">
      <div className="text-center text-lg font-medium">No agents found</div>
      <div className="text-center text-sm text-gray-500">Please add agents to your account to start chatting.</div>
    </div>
  ) : (
    <div className={`ai-chat ai-chat--with-sidebar ${className ?? ''}`.trim()} style={style}>
      <MessageHost />
      {showSessionSidebar ? (
        <ChatSessionsSidebar
          currentSessionId={activeSidebarSessionId}
          draftSession={draftSession}
          sessions={chatSessions}
          total={chatSessionsTotal}
          loading={chatSessionsLoading}
          loadingMore={chatSessionsLoadingMore}
          onLoadMore={() => void loadMoreChatSessions()}
          onSessionsChange={setChatSessions}
          onTotalChange={setChatSessionsTotal}
          renameChatSession={renameChatSession}
          deleteChatSession={deleteChatSession}
          batchDeleteChatSessions={batchDeleteChatSessions}
          onOpen={handleOpenSession}
          onNewChat={handleNewChat}
          onDraftResolved={resolveDraftSession}
          onDeleted={handleSessionDeleted}
        />
      ) : null}

      <div className="ai-chat-main flex flex-col min-w-0 min-h-0">
        {showAgentSelector ? (
          <AgentSelector
            disabled={isTurnInProgress}
            agents={allAgents}
            selectedAgentId={selectedAgentId}
            selectedAgent={selectedAgent}
            onSelectAgent={handleSelectAgent}
            // onSearchAgents={searchAgents}
          />
        ) : null}

        {showConnectionControls ? (
          <div className="ai-chat-header">
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <div className="flex flex-col gap-1">
                <div className="text-sm font-medium">{title}</div>
                {sessionId ? (
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    session: {sessionId}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className={streamTag.className}>{streamTag.text}</span>
                <span className={sessionTag.className}>{sessionTag.text}</span>
                {!sessionId ? (
                  <button
                    type="button"
                    className="ai-chat-btn ai-chat-btn--primary"
                    disabled={actionLoading || !selectedAgentId}
                    onClick={() => void handleCreateSession()}
                  >
                    Create Session
                  </button>
                ) : null}
                <button type="button" className="ai-chat-btn" disabled={!hasOpenStream} onClick={() => disconnect()}>
                  Stop Stream
                </button>
                <button
                  type="button"
                  className="ai-chat-btn"
                  disabled={!sessionId || actionLoading}
                  onClick={() => void handleCancelTurn()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ai-chat-btn ai-chat-btn--danger"
                  disabled={!sessionId || actionLoading}
                  onClick={() => void handleCloseSession()}
                >
                  Close Session
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <ChatMessagesPanel
          messages={chatState.messages}
          isStreaming={isTurnInProgress}
          isThinking={isThinking}
          planTodos={chatState.planTodos}
          title={selectedAgent?.name || title}
          sessionArtifacts={sessionArtifacts}
          messagesContainerRef={messagesContainerRef}
          bottomRef={bottomRef}
          onApprove={(callId, approved) => void handleApprove(callId, approved)}
          onOpenArtifact={openArtifact}
        />

        <ChatComposer
          ref={composerRef}
          disabled={chatState.streamStatus === StreamStatusEnum.ERROR || actionLoading || !selectedAgentId || !baseUrl}
          isStreaming={isTurnInProgress}
          placeholder={selectedAgentId ? placeholder : 'Select an agent first'}
          messagesContainerRef={messagesContainerRef}
          blobApi={blobApi}
          onSend={handleSubmit}
          onCancel={() => void handleCancelTurn()}
        />
      </div>

      {activeArtifact ? (
        <Suspense fallback={null}>
          <ArtifactDrawer artifact={activeArtifact} fileApi={fileApi} onClose={() => setActiveArtifact(null)} />
        </Suspense>
      ) : null}
    </div>
  );
}
