import { apiRequest } from './api-request';
import { AgentApiOptions, AgentDefinition, ListAgentsParams, ListAgentsResponse } from './agent-api-types';
import { buildAuthHeaders, joinApiUrl } from './utils';

export class AgentApi {
  #baseUrl: string;
  #apiKey?: string;
  #fetch: typeof fetch;
  #headers: Record<string, string>;

  constructor(options: AgentApiOptions) {
    this.#baseUrl = options.baseUrl;
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? fetch.bind(globalThis);
    this.#headers = options.headers ?? {};
  }

  async listAgents(params: ListAgentsParams = {}): Promise<ListAgentsResponse> {
    const searchParams = new URLSearchParams();
    if (params.my !== undefined) {
      searchParams.set('my', String(params.my));
    }
    if (params.query) {
      searchParams.set('query', params.query);
    }
    if (params.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }
    if (params.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params.sort) {
      searchParams.set('sort', params.sort);
    }
    if (params.includeSystemDefault !== undefined) {
      searchParams.set('include_system_default', String(params.includeSystemDefault));
    }

    const query = searchParams.toString();
    const path = query ? `/api/agents?${query}` : '/api/agents';
    return this.#request<ListAgentsResponse>(path);
  }

  async getAgent(agentId: string): Promise<AgentDefinition> {
    return this.#request<AgentDefinition>(`/api/agents/${encodeURIComponent(agentId)}`);
  }

  async #request<T>(path: string): Promise<T> {
    const url = joinApiUrl(this.#baseUrl, path);
    const headers = buildAuthHeaders(this.#apiKey, this.#headers);

    return apiRequest<T>({
      fetch: this.#fetch,
      url,
      method: 'GET',
      headers,
    });
  }
}
