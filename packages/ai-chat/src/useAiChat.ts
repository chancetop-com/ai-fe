import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApproveDecision,
  AiLibOptions,
  APIException,
  ChatSessionSummary,
  CreateSessionRequest,
  ListChatSessionsResponse,
  SendMessageAttachment,
  SessionArtifact,
  SessionStatus,
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
import {
  clearActiveAgentBubble,
  ensureTrailingAgentBubble,
  mergeHistoryWithLive,
  resolveRestoredTurn,
} from './stream-recovery';
import { formatApiError } from './utils';

const TURN_WATCHDOG_INTERVAL_MS = 10_000;
const MAX_TURN_RECONNECTS = 3;

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

function buildHydratedChatState(
  messages: ReturnType<typeof historyToChatMessages>,
  sessionStatus: SessionStatus | null
): ChatState {
  const isRunning = sessionStatus === 'running';
  return {
    ...initialChatState,
    messages: isRunning ? ensureTrailingAgentBubble(messages) : messages,
    sessionStatus,
    streamStatus: isRunning ? StreamStatusEnum.CONNECTING : StreamStatusEnum.IDLE,
  };
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
  const localTurnActiveRef = useRef(false);
  const pendingTurnRef = useRef<string | null>(null);
  const [pendingTurnSid, setPendingTurnSid] = useState<string | null>(null);
  const turnReconnectsRef = useRef(0);
  const suppressRecoverRef = useRef(false);
  const recoverTurnRef = useRef<(sid: string) => void>(() => {});
  const cancelledSessionIdsRef = useRef<Set<string>>(new Set());
  const refreshChatSessionsRef = useRef<(() => Promise<void>) | null>(null);
  const sessionIdRef = useRef<string | undefined>(
    sessionId ?? (allowInitialSessionIdRef.current ? initialSessionId : undefined)
  );
  const refreshApiKeyRef = useRef(refreshApiKey);
  refreshApiKeyRef.current = refreshApiKey;
  const sessionStatusRef = useRef(chatState.sessionStatus);
  sessionStatusRef.current = chatState.sessionStatus;

  useEffect(() => {
    sessionIdRef.current =
      sessionId ?? (allowInitialSessionIdRef.current ? initialSessionId : undefined);
  }, [initialSessionId, sessionId]);

  const assignSessionId = useCallback(
    (nextSessionId: string | undefined) => {
      sessionIdRef.current = nextSessionId;
      setSessionId(nextSessionId);
    },
    [setSessionId]
  );

  const markTurnPending = useCallback((sid: string) => {
    pendingTurnRef.current = sid;
    setPendingTurnSid(sid);
    turnReconnectsRef.current = 0;
  }, []);

  const clearTurnPending = useCallback(() => {
    pendingTurnRef.current = null;
    setPendingTurnSid(null);
    turnReconnectsRef.current = 0;
  }, []);

  const connectRunningSession = useCallback(
    (resolvedSessionId: string) => {
      localTurnActiveRef.current = false;
      // Clear before replay so POST-streamed text is not duplicated by PUT event replay.
      setChatState((prev) => ({
        ...prev,
        messages: clearActiveAgentBubble(prev.messages),
        sessionStatus: 'running',
        streamStatus: StreamStatusEnum.CONNECTING,
      }));
      agentSession.connectSessionEvents(resolvedSessionId);
    },
    [agentSession]
  );

  const recoverTurn = useCallback(
    (sid: string) => {
      if (suppressRecoverRef.current) return;
      if (sessionIdRef.current !== sid) return;
      if (pendingTurnRef.current !== sid) return;
      if (turnReconnectsRef.current >= MAX_TURN_RECONNECTS) return;
      turnReconnectsRef.current += 1;
      setChatState((prev) => ({
        ...prev,
        sessionStatus: 'running',
        streamStatus: StreamStatusEnum.CONNECTING,
      }));
      connectRunningSession(sid);
    },
    [connectRunningSession]
  );

  useEffect(() => {
    recoverTurnRef.current = recoverTurn;
  }, [recoverTurn]);

  const syncFromHistory = useCallback(
    async (sid: string) => {
      try {
        const history = await sessionApi.getHistory(sid);
        if (sessionIdRef.current !== sid) return false;

        const hydrated = historyToChatMessages(history.messages);
        setChatState((prev) => ({
          ...prev,
          messages: mergeHistoryWithLive(hydrated, prev.messages),
          sessionStatus: 'idle',
          streamStatus: StreamStatusEnum.CLOSED,
          isThinking: false,
          planTodos: null,
        }));
        setSessionArtifacts(history.artifacts ?? []);
        clearTurnPending();
        return true;
      } catch (error) {
        console.warn('failed to sync history after stream loss', error);
        return false;
      }
    },
    [clearTurnPending, sessionApi]
  );

  const applyRestoredTurn = useCallback(
    (
      sid: string,
      sessionStatus: SessionStatus | null,
      messages: ReturnType<typeof historyToChatMessages>,
      locallyCancelled: boolean
    ) => {
      const action = resolveRestoredTurn(sessionStatus, messages, locallyCancelled);
      if (action === 'resume') {
        markTurnPending(sid);
        connectRunningSession(sid);
      } else if (action === 'resync') {
        void syncFromHistory(sid);
      }
    },
    [connectRunningSession, markTurnPending, syncFromHistory]
  );

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
      suppressRecoverRef.current = true;
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
      const eventSessionId = event.sessionId;
      if (
        eventSessionId &&
        sessionIdRef.current &&
        eventSessionId !== sessionIdRef.current
      ) {
        return;
      }
      if (eventSessionId && cancelledSessionIdsRef.current.has(eventSessionId)) {
        if (event.type === 'status_change' && event.status === 'running') {
          return;
        }
        if (event.type !== 'turn_complete' && event.type !== 'error') {
          return;
        }
      }

      if (
        event.type === 'status_change' &&
        event.status === 'running' &&
        !pendingTurnRef.current &&
        !localTurnActiveRef.current
      ) {
        return;
      }

      if (event.type === 'error' && isSseUnauthorizedError(event) && refreshApiKeyRef.current) {
        void retrySendAfterUnauthorized().then((retried) => {
          if (!retried) {
            setChatState((prev) => reduceChatState(prev, event));
            clearTurnPending();
          }
        });
        return;
      }

      if (event.type === 'turn_complete') {
        localTurnActiveRef.current = false;
        clearTurnPending();
      }

      setChatState((prev) => {
        let next = prev;
        if (event.type === 'status_change' && event.status === 'running') {
          const sid = pendingTurnRef.current;
          if (sid && (!event.sessionId || event.sessionId === sid)) {
            next = { ...prev, messages: clearActiveAgentBubble(prev.messages) };
          }
        }
        return reduceChatState(next, event);
      });
      if (event.type === 'turn_complete') {
        const sid = event.sessionId ?? sessionIdRef.current;
        if (sid) {
          if (event.cancelled) {
            cancelledSessionIdsRef.current.add(sid);
          } else {
            cancelledSessionIdsRef.current.delete(sid);
          }
        }
        void refreshChatSessionsRef.current?.();
      }
      if (event.type === 'tool_result' && event.tool_name === 'submit_artifacts' && event.result) {
        const additions = extractSessionArtifactsFromToolResult(event.result);
        if (additions.length > 0) {
          setSessionArtifacts((prev) => mergeSessionArtifacts(prev, additions));
        }
      }
    },
    [clearTurnPending, retrySendAfterUnauthorized]
  );

  useAiLibSubscription(aiLib, {
    onMessage: appendEvent,
    onOpen: () => {
      setChatState((prev) => applyStreamState(prev, StreamStatusEnum.OPEN));
    },
    onDisconnect: () => {
      if (suppressRecoverRef.current) {
        suppressRecoverRef.current = false;
        setChatState((prev) => applyStreamState(prev, StreamStatusEnum.CLOSED));
        return;
      }
      const sid = sessionIdRef.current;
      if (pendingTurnRef.current && sid && pendingTurnRef.current === sid) {
        recoverTurnRef.current(sid);
        return;
      }
      setChatState((prev) => applyStreamState(prev, StreamStatusEnum.CLOSED));
    },
    onError: (error) => {
      const sid = sessionIdRef.current;
      if (pendingTurnRef.current && sid && pendingTurnRef.current === sid) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('rejected') || msg.includes('401') || msg.includes('403')) {
          clearTurnPending();
        } else {
          setChatState((prev) => applyStreamState(prev, StreamStatusEnum.CLOSED));
          return;
        }
      }
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
        const [history, status] = await Promise.all([
          sessionApi.getHistory(resolvedSessionId),
          sessionApi.getStatus(resolvedSessionId).catch(() => null),
        ]);
        const sessionStatus = status?.status ?? null;
        const messages = historyToChatMessages(history.messages);
        const locallyCancelled = cancelledSessionIdsRef.current.has(resolvedSessionId);
        setChatState(buildHydratedChatState(messages, locallyCancelled && sessionStatus === 'running' ? 'idle' : sessionStatus));
        setSessionArtifacts(history.artifacts ?? []);
        applyRestoredTurn(resolvedSessionId, sessionStatus, messages, locallyCancelled);
      }

      assignSessionId(resolvedSessionId);
      return resolvedSessionId;
    },
    [
      agentSession,
      autoCreateSession,
      assignSessionId,
      buildCreateSessionRequest,
      initialSessionId,
      loadHistoryOnConnect,
      sessionApi,
      sessionId,
      applyRestoredTurn,
    ]
  );

  const disconnect = useCallback(() => {
    aiLib.disconnect();
  }, [aiLib]);

  const stopStream = useCallback(() => {
    suppressRecoverRef.current = true;
    clearTurnPending();
    aiLib.disconnect();
    setChatState((prev) => applyStreamState(prev, StreamStatusEnum.CLOSED));
  }, [aiLib, clearTurnPending]);

  const resetChatState = useCallback(() => {
    clearTurnPending();
    setChatState(initialChatState);
    setSessionArtifacts([]);
  }, [clearTurnPending]);

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

      suppressRecoverRef.current = true;
      resetChatState();
      disconnect();
      setDraftSession(null);
      assignSessionId(session.id);

      if (session.agent_id) {
        setSelectedAgentId(session.agent_id);
      }

      try {
        const [history, status] = await Promise.all([
          sessionApi.getHistory(session.id),
          sessionApi.getStatus(session.id).catch(() => null),
        ]);
        if (!isCurrentHydration()) return;

        const locallyCancelled = cancelledSessionIdsRef.current.has(session.id);
        const rawStatus = status?.status ?? null;
        const sessionStatus =
          locallyCancelled && rawStatus === 'running' ? ('idle' as const) : rawStatus;
        const messages = historyToChatMessages(history.messages);

        setChatState(buildHydratedChatState(messages, sessionStatus));
        setSessionArtifacts(history.artifacts ?? []);
        applyRestoredTurn(session.id, rawStatus, messages, locallyCancelled);
      } catch (error) {
        if (!isCurrentHydration()) return;
        console.warn('failed to hydrate session history', error);
        message.error(formatApiError(error, 'Failed to load conversation'));
      }
    },
    [applyRestoredTurn, assignSessionId, disconnect, resetChatState, sessionApi]
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

  refreshChatSessionsRef.current = refreshChatSessions;

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
    localTurnActiveRef.current = false;
    suppressRecoverRef.current = true;
    resetChatState();
    disconnect();
    assignSessionId(undefined);
    createDraftSession();
  }, [assignSessionId, createDraftSession, disconnect, resetChatState]);

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
      suppressRecoverRef.current = true;
      resetChatState();
      disconnect();
      assignSessionId(undefined);
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
    [assignSessionId, createDraftSession, disconnect, fetchChatSessions, openFirstSessionFromList, resetChatState]
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
      streamStatus: StreamStatusEnum.CONNECTING,
      isThinking: false,
    }));
  }, []);

  const sendMessage = useCallback(
    async (content: string, variables?: Record<string, string>, attachments?: SendMessageAttachment[]) => {
      const trimmed = content.trim();
      const hasAttachments = Boolean(attachments?.length);
      if (!trimmed && !hasAttachments) return;

      if (sessionStatusRef.current === 'running' && !localTurnActiveRef.current) {
        message.warning('Session is still running. Cancel the current turn before sending a new message.');
        return;
      }

      const hadSession = Boolean(sessionId ?? (allowInitialSessionIdRef.current ? initialSessionId : undefined));
      const activeDraftSession = draftSession;
      const resolvedSessionId = await prepareSession();
      cancelledSessionIdsRef.current.delete(resolvedSessionId);
      pendingSendRef.current = {
        content: trimmed,
        variables,
        attachments,
        sessionId: resolvedSessionId,
        unauthorizedRetryAttempted: false,
      };
      localTurnActiveRef.current = true;
      markTurnPending(resolvedSessionId);
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
      markTurnPending,
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
    if (!pendingTurnSid) return;

    let stopped = false;
    let timer: number | undefined;
    let failures = 0;
    let nonRunningPolls = 0;

    const poll = async () => {
      try {
        const res = await sessionApi.getStatus(pendingTurnSid);
        if (stopped) return;
        failures = 0;

        if (res.status === 'running') {
          nonRunningPolls = 0;
        } else if (nonRunningPolls < 1) {
          nonRunningPolls += 1;
        } else if (res.status === 'error') {
          await syncFromHistory(pendingTurnSid);
          setChatState((prev) => {
            const last = prev.messages[prev.messages.length - 1];
            if (last?.role === 'assistant' && last.segments.length === 0) {
              const messages = [...prev.messages];
              messages[messages.length - 1] = {
                ...last,
                segments: [
                  {
                    type: 'text',
                    content: 'Error: turn failed without a streamed error event',
                  },
                ],
                streaming: false,
              };
              return { ...prev, messages };
            }
            return prev;
          });
          return;
        } else {
          await syncFromHistory(pendingTurnSid);
          return;
        }
      } catch (error) {
        failures += 1;
        if (failures >= 5) {
          console.warn('status watchdog gave up', error);
          clearTurnPending();
          setChatState((prev) => ({
            ...prev,
            sessionStatus: 'idle',
            streamStatus: StreamStatusEnum.CLOSED,
            isThinking: false,
          }));
          return;
        }
      }

      if (!stopped) {
        timer = window.setTimeout(poll, TURN_WATCHDOG_INTERVAL_MS);
      }
    };

    timer = window.setTimeout(poll, TURN_WATCHDOG_INTERVAL_MS);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [clearTurnPending, pendingTurnSid, sessionApi, syncFromHistory]);

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

  const resolveActiveSessionId = useCallback(() => {
    return sessionId ?? (allowInitialSessionIdRef.current ? initialSessionId : undefined);
  }, [initialSessionId, sessionId]);

  const applyStreamClosedState = useCallback(() => {
    setChatState((prev) => applyStreamState(prev, StreamStatusEnum.CLOSED));
  }, []);

  const cancelTurn = useCallback(async () => {
    const resolvedSessionId = resolveActiveSessionId();
    if (!resolvedSessionId) {
      throw new Error('sessionId is required to cancel turn');
    }

    // Cancel is async server-side; status may stay "running" briefly after 204.
    // Mirror core-ai: treat the turn as stopped locally and ignore stale SSE/status.
    cancelledSessionIdsRef.current.add(resolvedSessionId);
    suppressRecoverRef.current = true;
    clearTurnPending();
    localTurnActiveRef.current = false;
    aiLib.disconnect();

    setChatState((prev) => {
      const last = prev.messages[prev.messages.length - 1];
      let messages = prev.messages;
      if (
        last?.role === 'assistant' &&
        last.streaming &&
        last.segments.length === 0 &&
        !last.approval
      ) {
        messages = messages.slice(0, -1);
      } else if (last?.role === 'assistant' && last.streaming) {
        messages = messages.map((message, index) =>
          index === messages.length - 1 ? { ...message, streaming: false } : message
        );
      }

      return applyStreamState(
        { ...prev, messages, planTodos: null },
        StreamStatusEnum.CLOSED,
        null,
        'idle'
      );
    });

    await sessionApi.cancelTurn(resolvedSessionId);
  }, [aiLib, resolveActiveSessionId, sessionApi]);

  const closeSession = useCallback(async () => {
    const resolvedSessionId = resolveActiveSessionId();
    if (!resolvedSessionId) {
      throw new Error('sessionId is required to close session');
    }

    if (chatState.sessionStatus === 'running') {
      cancelledSessionIdsRef.current.add(resolvedSessionId);
      suppressRecoverRef.current = true;
      clearTurnPending();
      try {
        await sessionApi.cancelTurn(resolvedSessionId);
      } catch (error) {
        console.warn('failed to cancel turn before closing session', error);
      }
      aiLib.disconnect();
      applyStreamClosedState();
    }

    await agentSession.closeSession();
    resetChatState();
    setDraftSession(null);
  }, [
    agentSession,
    aiLib,
    applyStreamClosedState,
    chatState.sessionStatus,
    clearTurnPending,
    resetChatState,
    resolveActiveSessionId,
    sessionApi,
  ]);

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
    sessionArtifacts,
    prepareSession,
    disconnect,
    stopStream,
    resetChatState,
    startNewChat,
    openChatSession,
    selectAgent,
    resolveDraftSession,
    handleSessionDeleted,
    sendUserMessage,
    sendMessage,
    approveToolCall,
    cancelTurn,
    closeSession,
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
