import { useCallback, useState } from 'react';
import {
  AiLibOptions,
  ApproveDecision,
  ApproveToolCallRequest,
  CreateSessionRequest,
  SendMessageAttachment,
  SessionApi,
} from '@connexup/ai-api';
import { useAiLib } from './useAiLib';
import { useSessionApi } from './useSessionApi';

export interface UseAgentSessionOptions
  extends Pick<AiLibOptions, 'baseUrl' | 'apiKey' | 'sessionId' | 'streamPath' | 'loggerUrl' | 'acceptEventTypes'> {
  sessionApi?: SessionApi;
}

export function useAgentSession(options: UseAgentSessionOptions) {
  const defaultSessionApi = useSessionApi({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
  });
  const sessionApi = options.sessionApi ?? defaultSessionApi;
  const [sessionId, setSessionId] = useState<string | undefined>(options.sessionId);
  const aiLib = useAiLib({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    sessionId,
    streamPath: options.streamPath,
    loggerUrl: options.loggerUrl,
    acceptEventTypes: options.acceptEventTypes,
  });

  const resolveSessionId = useCallback(
    (targetSessionId?: string) => targetSessionId ?? sessionId ?? options.sessionId,
    [options.sessionId, sessionId]
  );

  const createSession = useCallback(
    async (request: CreateSessionRequest = {}) => {
      const response = await sessionApi.createSession(request);
      setSessionId(response.sessionId);
      return response;
    },
    [sessionApi]
  );

  const setApiKey = useCallback(
    (nextApiKey: string | undefined) => {
      aiLib.setApiKey(nextApiKey);
      sessionApi.setApiKey(nextApiKey);
    },
    [aiLib, sessionApi]
  );

  const sendMessage = useCallback(
    (
      message: string,
      variables?: Record<string, string>,
      attachments?: SendMessageAttachment[],
      targetSessionId?: string,
      apiKeyOverride?: string
    ) => {
      const resolvedSessionId = targetSessionId ?? resolveSessionId();
      if (!resolvedSessionId) {
        throw new Error('sessionId is required to send message');
      }

      aiLib.sendMessage({
        sessionId: resolvedSessionId,
        message,
        variables,
        attachments,
        apiKey: apiKeyOverride,
      });
    },
    [aiLib, resolveSessionId]
  );

  const approveToolCall = useCallback(
    async (callId: string, decision: ApproveDecision | boolean) => {
      const resolvedSessionId = resolveSessionId();
      if (!resolvedSessionId) {
        throw new Error('sessionId is required to approve tool call');
      }

      const request: ApproveToolCallRequest = {
        call_id: callId,
        decision: typeof decision === 'boolean' ? (decision ? 'APPROVE' : 'DENY') : decision,
      };

      await sessionApi.approveToolCall(resolvedSessionId, request);
    },
    [resolveSessionId, sessionApi]
  );

  const cancelTurn = useCallback(async () => {
    const resolvedSessionId = resolveSessionId();
    if (!resolvedSessionId) {
      throw new Error('sessionId is required to cancel turn');
    }
    await sessionApi.cancelTurn(resolvedSessionId);
    aiLib.disconnect();
  }, [aiLib, resolveSessionId, sessionApi]);

  const closeSession = useCallback(async () => {
    const resolvedSessionId = resolveSessionId();
    if (!resolvedSessionId) {
      throw new Error('sessionId is required to close session');
    }
    await sessionApi.closeSession(resolvedSessionId);
    aiLib.disconnect();
    setSessionId(undefined);
  }, [aiLib, resolveSessionId, sessionApi]);

  return {
    sessionApi,
    aiLib,
    sessionId,
    setSessionId,
    createSession,
    setApiKey,
    sendMessage,
    approveToolCall,
    cancelTurn,
    closeSession,
    getHistory: sessionApi.getHistory.bind(sessionApi),
    getStatus: sessionApi.getStatus.bind(sessionApi),
    loadTools: sessionApi.loadTools.bind(sessionApi),
    loadSkills: sessionApi.loadSkills.bind(sessionApi),
    loadSubAgents: sessionApi.loadSubAgents.bind(sessionApi),
    generateAgentDraft: sessionApi.generateAgentDraft.bind(sessionApi),
    listChatSessions: sessionApi.listChatSessions.bind(sessionApi),
    getChatSession: sessionApi.getChatSession.bind(sessionApi),
    renameChatSession: sessionApi.renameChatSession.bind(sessionApi),
    batchDeleteChatSessions: sessionApi.batchDeleteChatSessions.bind(sessionApi),
    deleteChatSession: sessionApi.deleteChatSession.bind(sessionApi),
  };
}
