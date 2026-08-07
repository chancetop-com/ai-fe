import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApproveDecision,
  AiLibOptions,
  APIException,
  ChatSessionSummary,
  CreateSessionRequest,
  ListChatSessionsResponse,
  SendMessageAttachment,
  SessionArtifact,
  StreamStatusEnum,
  SessionApi,
  SseEvent,
} from '@connexup/ai-api';
import { useAgentSession, useAiLibSubscription } from '@connexup/ai-react';
import {
  applyStreamState,
  ChatState,
  createAgentPlaceholder,
  createUserMessage,
  historyToChatMessages,
  initialChatState,
  reduceChatState,
} from './chat-state';
import { extractSessionArtifactsFromToolResult, mergeSessionArtifacts } from './artifact-utils';
import { message } from './message';
import { isSseUnauthorizedError } from './sse-auth';
import { formatApiError } from './utils';

export const DRAFT_CHAT_SESSION_ID = '__new_chat_draft__';
export const CHAT_SESSIONS_PAGE_SIZE = 50;

export interface UseAiChatOptions extends AiLibOptions {
  autoCreateSession?: boolean;
  createSessionRequest?: CreateSessionRequest;
  loadHistoryOnConnect?: boolean;
  sessionApi?: SessionApi;
  defaultAgentId?: string;
  refreshApiKey?: () => Promise<string>;
}

interface PendingSendPayload {
  content: string;
  variables?: Record<string, string>;
  attachments?: SendMessageAttachment[];
  sessionId: string;
  unauthorizedRetryAttempted: boolean;
}

function titleFromMessage(text: string): string {
  const title = text.replace(/\s+/g, ' ').trim();
  return title ? title.slice(0, 40) : 'New Chat';
}

function buildSessionSummary(
  sessionId: string,
  agentId: string | undefined,
  content: string,
  attachments: SendMessageAttachment[] | undefined,
  draft: ChatSessionSummary | null
): ChatSessionSummary {
  const now = new Date().toISOString();
  return {
    id: sessionId,
    agent_id: agentId || undefined,
    source: 'chat',
    title: titleFromMessage(content || attachments?.[0]?.file_name || 'New Chat'),
    message_count: 1,
    created_at: draft?.created_at ?? now,
    last_message_at: now,
  };
}

export function useAiChat(options: UseAiChatOptions) {
  const {
    autoCreateSession = false,
    createSessionRequest,
    loadHistoryOnConnect = false,
    sessionApi: sessionApiOption,
    defaultAgentId,
    baseUrl,
    apiKey,
    sessionId: initialSessionId,
    refreshApiKey,
    ...aiLibOptions
  } = options;

  const agentSession = useAgentSession({
    baseUrl,
    apiKey,
    sessionId: initialSessionId,
    sessionApi: sessionApiOption,
    ...aiLibOptions,
  });

  const { aiLib, sessionApi, sessionId, setSessionId, setApiKey } = agentSession;
  const [chatState, setChatState] = useState<ChatState>(initialChatState);
  const [selectedAgentId, setSelectedAgentId] = useState(() => createSessionRequest?.agent_id ?? defaultAgentId ?? '');
  const [draftSession, setDraftSession] = useState<ChatSessionSummary | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([]);
  const [chatSessionsTotal, setChatSessionsTotal] = useState(0);
  const [chatSessionsLoading, setChatSessionsLoading] = useState(false);
  const [chatSessionsLoadingMore, setChatSessionsLoadingMore] = useState(false);
  const [sessionArtifacts, setSessionArtifacts] = useState<SessionArtifact[]>([]);
  const hydrateRequestSeqRef = useRef(0);
  const listRequestSeqRef = useRef(0);
  const sessionBootstrappedRef = useRef(false);
  const sessionsListSucceededRef = useRef(false);
  const pendingInitialDraftRef = useRef(false);
  const allowInitialSessionIdRef = useRef(true);
  const pendingSendRef = useRef<PendingSendPayload | null>(null);
  const refreshApiKeyRef = useRef(refreshApiKey);
  refreshApiKeyRef.current = refreshApiKey;

  const replaceAgentPlaceholder = useCallback(() => {
    setChatState((prev) => {
      const messages = [...prev.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex >= 0 && messages[lastIndex]?.role === 'assistant') {
        messages[lastIndex] = createAgentPlaceholder();
      }
      return {
        ...prev,
        messages,
        streamStatus: StreamStatusEnum.CONNECTING,
        error: null,
        isThinking: false,
      };
    });
  }, []);

  const retrySendAfterUnauthorized = useCallback(async () => {
    const pending = pendingSendRef.current;
    const refresh = refreshApiKeyRef.current;
    if (!pending || !refresh || pending.unauthorizedRetryAttempted) {
      return false;
    }

    pending.unauthorizedRetryAttempted = true;

    try {
      const nextApiKey = await refresh();
      setApiKey(nextApiKey);
      aiLib.disconnect();
      replaceAgentPlaceholder();
      agentSession.sendMessage(
        pending.content,
        pending.variables,
        pending.attachments,
        pending.sessionId,
        nextApiKey
      );
      return true;
    } catch (error) {
      console.warn('failed to refresh api key', error);
      message.error(formatApiError(error, 'Failed to refresh authorization'));
      return false;
    }
  }, [agentSession, aiLib, replaceAgentPlaceholder, setApiKey]);

  const appendEvent = useCallback(
    (event: SseEvent) => {
      if (event.type === 'error' && isSseUnauthorizedError(event) && refreshApiKeyRef.current) {
        void retrySendAfterUnauthorized().then((retried) => {
          if (!retried) {
            setChatState((prev) => reduceChatState(prev, event));
          }
        });
        return;
      }

      setChatState((prev) => reduceChatState(prev, event));
      if (event.type === 'tool_result' && event.tool_name === 'submit_artifacts' && event.result) {
        const additions = extractSessionArtifactsFromToolResult(event.result);
        if (additions.length > 0) {
          setSessionArtifacts((prev) => mergeSessionArtifacts(prev, additions));
        }
      }
    },
    [retrySendAfterUnauthorized]
  );

  useAiLibSubscription(aiLib, {
    onMessage: appendEvent,
    onOpen: () => {
      setChatState((prev) => applyStreamState(prev, StreamStatusEnum.OPEN));
    },
    onDisconnect: () => {
      setChatState((prev) => applyStreamState(prev, StreamStatusEnum.CLOSED));
    },
    onError: (error) => {
      setChatState((prev) =>
        applyStreamState(prev, StreamStatusEnum.ERROR, {
          errorCode: error instanceof APIException ? error.errorCode : 'network_error',
          errorMessage: formatApiError(error, 'Request failed'),
        })
      );
    },
  });

  const buildCreateSessionRequest = useCallback(
    (request?: CreateSessionRequest): CreateSessionRequest => ({
      ...createSessionRequest,
      ...request,
      agent_id: request?.agent_id ?? selectedAgentId ?? createSessionRequest?.agent_id ?? defaultAgentId,
    }),
    [createSessionRequest, defaultAgentId, selectedAgentId]
  );

  const prepareSession = useCallback(
    async (request?: CreateSessionRequest) => {
      let resolvedSessionId =
        sessionId ?? (allowInitialSessionIdRef.current ? initialSessionId : undefined);

      if (!resolvedSessionId) {
        const created = await agentSession.createSession(buildCreateSessionRequest(request));
        resolvedSessionId = created.sessionId;
        setDraftSession(null);
      }

      if (!resolvedSessionId) {
        throw new Error('sessionId is required');
      }

      allowInitialSessionIdRef.current = false;

      if (loadHistoryOnConnect) {
        const history = await sessionApi.getHistory(resolvedSessionId);
        setChatState((prev) => ({
          ...prev,
          messages: historyToChatMessages(history.messages),
        }));
        setSessionArtifacts(history.artifacts ?? []);
      }

      setSessionId(resolvedSessionId);
      return resolvedSessionId;
    },
    [
      agentSession,
      autoCreateSession,
      buildCreateSessionRequest,
      initialSessionId,
      loadHistoryOnConnect,
      sessionApi,
      sessionId,
      setSessionId,
    ]
  );

  const disconnect = useCallback(() => {
    aiLib.disconnect();
  }, [aiLib]);

  const resetChatState = useCallback(() => {
    setChatState(initialChatState);
    setSessionArtifacts([]);
  }, []);

  const createDraftSession = useCallback(
    (agentId?: string) => {
      const now = new Date().toISOString();
      setDraftSession({
        id: DRAFT_CHAT_SESSION_ID,
        agent_id: (agentId ?? selectedAgentId) || undefined,
        source: 'chat',
        title: 'New Chat',
        message_count: 0,
        created_at: now,
        last_message_at: now,
      });
    },
    [selectedAgentId]
  );

  const openChatSession = useCallback(
    async (session: ChatSessionSummary) => {
      if (!session.id || session.id === DRAFT_CHAT_SESSION_ID) return;

      const hydrateSeq = ++hydrateRequestSeqRef.current;
      const isCurrentHydration = () => hydrateSeq === hydrateRequestSeqRef.current;

      disconnect();
      resetChatState();
      setDraftSession(null);
      setSessionId(session.id);

      if (session.agent_id) {
        setSelectedAgentId(session.agent_id);
      }

      try {
        const [history, status] = await Promise.all([
          sessionApi.getHistory(session.id),
          sessionApi.getStatus(session.id).catch(() => null),
        ]);
        if (!isCurrentHydration()) return;

        setChatState({
          ...initialChatState,
          messages: historyToChatMessages(history.messages),
          sessionStatus: status?.status ?? null,
        });
        setSessionArtifacts(history.artifacts ?? []);
      } catch (error) {
        if (!isCurrentHydration()) return;
        console.warn('failed to hydrate session history', error);
        message.error(formatApiError(error, 'Failed to load conversation'));
      }
    },
    [disconnect, resetChatState, sessionApi, setSessionId]
  );

  const fetchChatSessions = useCallback(
    async (
      offset: number,
      limit: number,
      options?: { append?: boolean; showError?: boolean; agentId?: string }
    ) => {
      const { append = false, showError = true, agentId } = options ?? {};
      const seq = ++listRequestSeqRef.current;
      const agentIds = agentId ?? selectedAgentId;

      if (append) {
        setChatSessionsLoadingMore(true);
      } else {
        setChatSessionsLoading(true);
      }

      try {
        const response = await sessionApi.listChatSessions({ offset, limit, agent_ids: agentIds });
        if (seq !== listRequestSeqRef.current) return response;

        const sessions = response.sessions ?? [];
        const total = response.total ?? sessions.length;

        if (append) {
          setChatSessions((prev) => [...prev, ...sessions]);
        } else {
          setChatSessions(sessions);
        }
        setChatSessionsTotal(total);
        sessionsListSucceededRef.current = true;
        return response;
      } catch (error) {
        if (seq !== listRequestSeqRef.current) throw error;
        console.warn('failed to list chat sessions', error);
        if (showError) {
          message.error(formatApiError(error, 'Failed to load conversations'));
        }
        if (!append) {
          setChatSessions([]);
          setChatSessionsTotal(0);
        }
        sessionsListSucceededRef.current = true;
        throw error;
      } finally {
        if (seq === listRequestSeqRef.current) {
          if (append) {
            setChatSessionsLoadingMore(false);
          } else {
            setChatSessionsLoading(false);
          }
        }
      }
    },
    [selectedAgentId, sessionApi]
  );

  const refreshChatSessions = useCallback(async () => {
    try {
      await fetchChatSessions(0, CHAT_SESSIONS_PAGE_SIZE, { showError: false });
    } catch {
      // Errors are surfaced during bootstrap; silent refresh avoids duplicate toasts.
    }
  }, [fetchChatSessions]);

  const prependChatSession = useCallback((session: ChatSessionSummary) => {
    setChatSessions((prev) => {
      const exists = prev.some((item) => item.id === session.id);
      if (!exists) {
        setChatSessionsTotal((total) => total + 1);
      }
      return [session, ...prev.filter((item) => item.id !== session.id)];
    });
  }, []);

  const startNewChat = useCallback(() => {
    hydrateRequestSeqRef.current += 1;
    allowInitialSessionIdRef.current = false;
    disconnect();
    setSessionId(undefined);
    resetChatState();
    createDraftSession();
  }, [createDraftSession, disconnect, resetChatState, setSessionId]);

  const loadMoreChatSessions = useCallback(async () => {
    try {
      await fetchChatSessions(chatSessions.length, CHAT_SESSIONS_PAGE_SIZE, {
        append: true,
        showError: true,
      });
    } catch {
      // Error toast is shown in fetchChatSessions.
    }
  }, [chatSessions.length, fetchChatSessions]);

  const openFirstSessionFromList = useCallback(
    async (response: ListChatSessionsResponse) => {
      const first = response.sessions?.[0];
      if (first?.id) {
        await openChatSession(first);
        return { opened: true as const };
      }
      return { opened: false as const };
    },
    [openChatSession]
  );

  const selectAgent = useCallback(
    async (agentId: string) => {
      hydrateRequestSeqRef.current += 1;
      const selectSeq = hydrateRequestSeqRef.current;

      allowInitialSessionIdRef.current = false;
      disconnect();
      setSessionId(undefined);
      resetChatState();
      setDraftSession(null);
      setSelectedAgentId(agentId);

      let opened = false;
      try {
        const response = await fetchChatSessions(0, CHAT_SESSIONS_PAGE_SIZE, { agentId });
        if (selectSeq !== hydrateRequestSeqRef.current) return;
        const result = await openFirstSessionFromList(response);
        opened = result.opened;
      } catch {
        if (selectSeq !== hydrateRequestSeqRef.current) return;
      }

      if (opened) return;

      createDraftSession(agentId);
    },
    [createDraftSession, disconnect, fetchChatSessions, openFirstSessionFromList, resetChatState, setSessionId]
  );

  const resolveDraftSession = useCallback(() => {
    setDraftSession(null);
  }, []);

  const sendUserMessage = useCallback((content: string, attachments?: SendMessageAttachment[]) => {
    const trimmed = content.trim();
    const hasAttachments = Boolean(attachments?.length);
    if (!trimmed && !hasAttachments) return;

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, createUserMessage(trimmed, attachments), createAgentPlaceholder()],
      isThinking: false,
    }));
  }, []);

  const sendMessage = useCallback(
    async (content: string, variables?: Record<string, string>, attachments?: SendMessageAttachment[]) => {
      const trimmed = content.trim();
      const hasAttachments = Boolean(attachments?.length);
      if (!trimmed && !hasAttachments) return;

      const hadSession = Boolean(sessionId ?? (allowInitialSessionIdRef.current ? initialSessionId : undefined));
      const activeDraftSession = draftSession;
      const resolvedSessionId = await prepareSession();
      pendingSendRef.current = {
        content: trimmed,
        variables,
        attachments,
        sessionId: resolvedSessionId,
        unauthorizedRetryAttempted: false,
      };
      sendUserMessage(trimmed, attachments);
      agentSession.sendMessage(trimmed, variables, attachments, resolvedSessionId);

      if (activeDraftSession || !hadSession) {
        prependChatSession(
          buildSessionSummary(resolvedSessionId, selectedAgentId, trimmed, attachments, activeDraftSession)
        );
        setDraftSession(null);
      }
    },
    [
      agentSession,
      draftSession,
      initialSessionId,
      prependChatSession,
      prepareSession,
      selectedAgentId,
      sendUserMessage,
      sessionId,
    ]
  );

  const createSession = useCallback(
    async (request: CreateSessionRequest = {}) => {
      const response = await agentSession.createSession(buildCreateSessionRequest(request));
      setDraftSession(null);
      void refreshChatSessions();
      return response;
    },
    [agentSession, buildCreateSessionRequest, refreshChatSessions]
  );

  const bootstrapInitialSession = useCallback(async () => {
    if (sessionBootstrappedRef.current) return;
    sessionBootstrappedRef.current = true;

    if (initialSessionId) {
      if (!loadHistoryOnConnect) {
        await openChatSession({
          id: initialSessionId,
          source: 'chat',
        });
      }
      return;
    }

    let opened = false;
    try {
      const response = await fetchChatSessions(0, CHAT_SESSIONS_PAGE_SIZE);
      const result = await openFirstSessionFromList(response);
      opened = result.opened;
    } catch {
      // List errors are non-blocking; continue with draft session flow.
    }
    if (opened) return;

    const agentId = selectedAgentId || createSessionRequest?.agent_id || defaultAgentId;
    if (!agentId) {
      pendingInitialDraftRef.current = true;
      return;
    }

    startNewChat();
  }, [
    createSessionRequest?.agent_id,
    defaultAgentId,
    initialSessionId,
    fetchChatSessions,
    loadHistoryOnConnect,
    openChatSession,
    openFirstSessionFromList,
    selectedAgentId,
    startNewChat,
  ]);

  useEffect(() => {
    if (autoCreateSession || loadHistoryOnConnect) {
      sessionBootstrappedRef.current = true;
      void prepareSession().catch(() => undefined);
      return;
    }
    void bootstrapInitialSession();
  }, [autoCreateSession, bootstrapInitialSession, loadHistoryOnConnect, prepareSession]);

  useEffect(() => {
    if (!pendingInitialDraftRef.current || sessionId || draftSession) return;
    if (!sessionsListSucceededRef.current) return;

    const agentId = selectedAgentId || createSessionRequest?.agent_id || defaultAgentId;
    if (!agentId) return;

    pendingInitialDraftRef.current = false;
    startNewChat();
  }, [createSessionRequest?.agent_id, defaultAgentId, draftSession, selectedAgentId, sessionId, startNewChat]);

  const approveToolCall = useCallback(
    async (callId: string, decision: ApproveDecision | boolean) => {
      await agentSession.approveToolCall(callId, decision);
    },
    [agentSession]
  );

  const messageMap = useMemo(() => {
    return new Map(chatState.messages.map((message) => [message.key, message]));
  }, [chatState.messages]);

  const activeSidebarSessionId = draftSession?.id ?? sessionId ?? null;

  const handleSessionDeleted = useCallback(
    (deletedSessionId: string, remainingSessions: ChatSessionSummary[]) => {
      if (deletedSessionId !== sessionId && deletedSessionId !== draftSession?.id) {
        return;
      }

      const latestSession = remainingSessions[0];
      if (latestSession) {
        void openChatSession(latestSession);
        return;
      }

      startNewChat();
    },
    [draftSession?.id, openChatSession, sessionId, startNewChat]
  );

  return {
    aiLib,
    sessionApi,
    sessionId,
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
    chatState,
    messageMap,
    sessionArtifacts,
    prepareSession,
    disconnect,
    resetChatState,
    startNewChat,
    openChatSession,
    selectAgent,
    resolveDraftSession,
    handleSessionDeleted,
    sendUserMessage,
    sendMessage,
    approveToolCall,
    cancelTurn: agentSession.cancelTurn,
    closeSession: agentSession.closeSession,
    createSession,
    getHistory: agentSession.getHistory,
    getStatus: agentSession.getStatus,
    loadTools: agentSession.loadTools,
    loadSkills: agentSession.loadSkills,
    loadSubAgents: agentSession.loadSubAgents,
    generateAgentDraft: agentSession.generateAgentDraft,
    listChatSessions: agentSession.listChatSessions,
    getChatSession: agentSession.getChatSession,
    renameChatSession: agentSession.renameChatSession,
    batchDeleteChatSessions: agentSession.batchDeleteChatSessions,
    deleteChatSession: agentSession.deleteChatSession,
  };
}
