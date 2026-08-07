export interface AgentDefinition {
  id: string;
  name: string;
  description?: string;
  model?: string;
  type?: string;
  status?: string;
  created_by?: string;
  system_default?: boolean;
}

export interface ListAgentsParams {
  my?: boolean;
  query?: string;
  limit?: number;
  page?: number;
  sort?: string;
  includeSystemDefault?: boolean;
}

export interface ListAgentsResponse {
  agents: AgentDefinition[];
}

export interface AgentApiOptions {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}
