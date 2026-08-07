import { apiRequest } from './api-request';
import {
  ApproveToolCallRequest,
  BatchDeleteChatSessionsResponse,
  ChatSessionSummary,
  CreateSessionRequest,
  CreateSessionResponse,
  DeleteChatSessionResponse,
  GenerateAgentDraftResponse,
  ListChatSessionsParams,
  ListChatSessionsResponse,
  LoadSkillsRequest,
  LoadSkillsResponse,
  LoadSubAgentsRequest,
  LoadSubAgentsResponse,
  LoadToolsRequest,
  LoadToolsResponse,
  RenameChatSessionResponse,
  SessionApiOptions,
  SessionHistoryResponse,
  SessionStatusResponse,
} from './session-api-types';
import { buildAuthHeaders, joinApiUrl } from './utils';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export class SessionApi {
  #baseUrl: string;
  #apiKey?: string;
  #fetch: typeof fetch;
  #headers: Record<string, string>;

  constructor(options: SessionApiOptions) {
    this.#baseUrl = options.baseUrl;
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? fetch.bind(globalThis);
    this.#headers = options.headers ?? {};
  }

  setApiKey(apiKey: string | undefined) {
    this.#apiKey = apiKey;
  }

  async createSession(request: CreateSessionRequest = {}): Promise<CreateSessionResponse> {
    return this.#request<CreateSessionResponse>('POST', '/api/sessions', request);
  }

  async getHistory(sessionId: string): Promise<SessionHistoryResponse> {
    return this.#request<SessionHistoryResponse>('GET', `/api/sessions/${encodeURIComponent(sessionId)}/history`);
  }

  async getStatus(sessionId: string): Promise<SessionStatusResponse> {
    return this.#request<SessionStatusResponse>('GET', `/api/sessions/${encodeURIComponent(sessionId)}/status`);
  }

  async approveToolCall(sessionId: string, request: ApproveToolCallRequest): Promise<void> {
    await this.#request<void>('POST', `/api/sessions/${encodeURIComponent(sessionId)}/approve`, request, [204]);
  }

  async cancelTurn(sessionId: string): Promise<void> {
    await this.#request<void>('POST', `/api/sessions/${encodeURIComponent(sessionId)}/cancel`, undefined, [204]);
  }

  async loadTools(sessionId: string, request: LoadToolsRequest): Promise<LoadToolsResponse> {
    return this.#request<LoadToolsResponse>('POST', `/api/sessions/${encodeURIComponent(sessionId)}/tools`, request, [
      201,
    ]);
  }

  async loadSkills(sessionId: string, request: LoadSkillsRequest): Promise<LoadSkillsResponse> {
    return this.#request<LoadSkillsResponse>('POST', `/api/sessions/${encodeURIComponent(sessionId)}/skills`, request, [
      201,
    ]);
  }

  async loadSubAgents(sessionId: string, request: LoadSubAgentsRequest): Promise<LoadSubAgentsResponse> {
    return this.#request<LoadSubAgentsResponse>(
      'POST',
      `/api/sessions/${encodeURIComponent(sessionId)}/subagents`,
      request,
      [201]
    );
  }

  async generateAgentDraft(sessionId: string): Promise<GenerateAgentDraftResponse> {
    return this.#request<GenerateAgentDraftResponse>(
      'POST',
      `/api/sessions/${encodeURIComponent(sessionId)}/generate-agent-draft`
    );
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.#request<void>('DELETE', `/api/sessions/${encodeURIComponent(sessionId)}`, undefined, [204]);
  }

  async listChatSessions(params: ListChatSessionsParams = {}): Promise<ListChatSessionsResponse> {
    const searchParams = new URLSearchParams();
    if (params.offset !== undefined) {
      searchParams.set('offset', String(params.offset));
    }
    if (params.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }
    if (params.sources !== undefined) {
      searchParams.set('sources', params.sources);
    }
    if (params.agent_ids !== undefined) {
      searchParams.set('agent_ids', params.agent_ids);
    }

    const query = searchParams.toString();
    const path = query ? `/api/chat/sessions?${query}` : '/api/chat/sessions';
    return this.#request<ListChatSessionsResponse>('GET', path);
  }

  async getChatSession(sessionId: string): Promise<ChatSessionSummary> {
    return this.#request<ChatSessionSummary>('GET', `/api/chat/sessions/${encodeURIComponent(sessionId)}`);
  }

  async renameChatSession(sessionId: string, title: string): Promise<RenameChatSessionResponse> {
    return this.#request<RenameChatSessionResponse>('PUT', `/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
      title,
    });
  }

  async batchDeleteChatSessions(sessionIds: string[]): Promise<BatchDeleteChatSessionsResponse> {
    return this.#request<BatchDeleteChatSessionsResponse>('POST', '/api/chat/sessions/batch-delete', {
      session_ids: sessionIds,
    });
  }

  async deleteChatSession(sessionId: string): Promise<DeleteChatSessionResponse> {
    return this.#request<DeleteChatSessionResponse>('DELETE', `/api/chat/sessions/${encodeURIComponent(sessionId)}`);
  }

  async #request<T>(
    method: RequestMethod,
    path: string,
    body?: unknown,
    successStatuses: number[] = [200, 201]
  ): Promise<T> {
    const url = joinApiUrl(this.#baseUrl, path);
    const headers = buildAuthHeaders(this.#apiKey, {
      ...this.#headers,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    });

    return apiRequest<T>({
      fetch: this.#fetch,
      url,
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      successStatuses,
    });
  }
}
