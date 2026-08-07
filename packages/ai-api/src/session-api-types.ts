export interface SessionConfig {
  model?: string;
  temperature?: number;
  system_prompt?: string;
  max_turns?: number;
  auto_approve_all?: boolean;
  working_directory?: string;
  mcp_servers?: string[];
}

export interface ToolRef {
  id: string;
  type?: 'local' | 'mcp' | 'openapi' | string;
  source?: string;
}

export interface CreateSessionRequest {
  agent_id?: string;
  config?: SessionConfig;
  tools?: ToolRef[];
  skill_ids?: string[];
  sub_agent_ids?: string[];
}

export interface CreateSessionResponse {
  sessionId: string;
  loaded_tools?: string[];
  loaded_skills?: string[];
  loaded_sub_agents?: string[];
}

export type SendMessageAttachmentType = 'PDF' | 'IMAGE' | 'FILE' | 'VIDEO';

export interface SendMessageAttachment {
  url: string;
  type: SendMessageAttachmentType | string;
  file_name?: string;
  content_type?: string;
  category?: string;
  container?: string;
  blob_name?: string;
}

export interface SendMessageRequest {
  message: string;
  variables?: Record<string, string>;
  attachments?: SendMessageAttachment[];
}

export interface SessionArtifact {
  file_id: string;
  file_name: string;
  content_type?: string;
  size?: number;
  title?: string;
  description?: string;
}

export interface ToolCallRecord {
  call_id: string;
  name: string;
  arguments?: string;
  result?: string;
  status?: 'success' | 'error' | string;
}

export interface SessionHistoryMessage {
  role: string;
  content: string;
  thinking?: string;
  tools?: ToolCallRecord[];
  seq?: number;
  trace_id?: string;
  timestamp?: string;
  metadata?: Record<string, string>;
}

export interface SessionHistoryResponse {
  messages: SessionHistoryMessage[];
  artifacts?: SessionArtifact[];
}

export interface SessionStatusResponse {
  sessionId: string;
  status: 'idle' | 'running' | 'error';
  createdAt?: string;
  lastActiveAt?: string;
  messageCount?: number;
  estimatedTokens?: number;
}

export type ApproveDecision = 'APPROVE' | 'APPROVE_ALWAYS' | 'APPROVE_SESSION' | 'DENY' | 'DENY_ALWAYS';

export interface ApproveToolCallRequest {
  call_id: string;
  decision: ApproveDecision;
}

export interface LoadToolsRequest {
  tools: ToolRef[];
}

export interface LoadToolsResponse {
  loaded_tools: string[];
}

export interface LoadSkillsRequest {
  skill_ids: string[];
}

export interface LoadSkillsResponse {
  loaded_skills: string[];
}

export interface LoadSubAgentsRequest {
  agent_ids: string[];
}

export interface LoadSubAgentsResponse {
  loaded_sub_agents: string[];
}

export interface GenerateAgentDraftResponse {
  name: string;
  description?: string;
  system_prompt: string;
  input_template?: string;
  model?: string;
  temperature?: number;
  max_turns?: number;
  tools?: ToolRef[];
}

export interface ListChatSessionsParams {
  offset?: number;
  limit?: number;
  sources?: string;
  agent_ids?: string;
}

export interface ChatSessionSummary {
  id: string;
  user_id?: string;
  agent_id?: string;
  source?: 'chat' | 'test' | 'api' | 'a2a' | 'scheduled' | string;
  schedule_id?: string;
  api_key_id?: string;
  title?: string;
  message_count?: number;
  created_at?: string;
  last_message_at?: string;
}

export interface ListChatSessionsResponse {
  sessions: ChatSessionSummary[];
  total?: number;
}

export interface RenameChatSessionRequest {
  title: string;
}

export interface RenameChatSessionResponse {
  updated: boolean;
}

export interface BatchDeleteChatSessionsRequest {
  session_ids: string[];
}

export interface BatchDeleteChatSessionsResponse {
  deleted: number;
}

export interface DeleteChatSessionResponse {
  deleted: boolean;
}

export interface ErrorResponse {
  error: string;
  message: string;
  detail?: string;
}

export interface SessionApiOptions {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}
