export type SessionStatus = 'idle' | 'running' | 'error';

export type ToolResultStatus = 'success' | 'error' | 'partial';

export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export type SandboxLifecycleStatus = 'creating' | 'ready' | 'error' | 'replacing' | 'terminated';

export interface SseBaseEvent {
  type: string;
  sessionId: string;
  timestamp: string;
}

export interface SseTextChunkEvent extends SseBaseEvent {
  type: 'text_chunk';
  content: string;
  is_final_chunk: boolean;
}

export interface SseReasoningChunkEvent extends SseBaseEvent {
  type: 'reasoning_chunk';
  content: string;
  is_final_chunk: boolean;
}

export interface SseToolStartEvent extends SseBaseEvent {
  type: 'tool_start';
  call_id: string;
  tool_name: string;
  tool_args?: Record<string, unknown>;
  tool_notes?: string;
  task_id?: string;
  run_in_background?: boolean;
  model?: string;
}

export interface SseToolResultEvent extends SseBaseEvent {
  type: 'tool_result';
  call_id: string;
  tool_name: string;
  status: ToolResultStatus;
  result?: string;
  tool_type?: string;
}

export interface SseToolApprovalRequestEvent extends SseBaseEvent {
  type: 'tool_approval_request';
  call_id: string;
  tool_name: string;
  arguments?: string;
  suggested_pattern?: string;
}

export interface SseTurnCompleteEvent extends SseBaseEvent {
  type: 'turn_complete';
  output?: string;
  cancelled?: boolean;
  max_turns_reached?: boolean;
  input_tokens?: number;
  output_tokens?: number;
}

export interface SseErrorEvent extends SseBaseEvent {
  type: 'error';
  message: string;
  detail?: string;
  errorCode?: string;
}

export interface SseStatusChangeEvent extends SseBaseEvent {
  type: 'status_change';
  status: SessionStatus;
}

export interface SsePlanUpdateEvent extends SseBaseEvent {
  type: 'plan_update';
  todos: Array<{
    content: string;
    status: TodoStatus;
  }>;
}

export interface SseCompressionEvent extends SseBaseEvent {
  type: 'compression';
  before_count: number;
  after_count: number;
  completed: boolean;
}

export interface SseSandboxEvent extends SseBaseEvent {
  type: 'sandbox';
  sandbox_id?: string;
  sandbox_type?: SandboxLifecycleStatus;
  message?: string;
  duration_ms?: number;
}

export type SseEvent =
  | SseTextChunkEvent
  | SseReasoningChunkEvent
  | SseToolStartEvent
  | SseToolResultEvent
  | SseToolApprovalRequestEvent
  | SseTurnCompleteEvent
  | SseErrorEvent
  | SseStatusChangeEvent
  | SsePlanUpdateEvent
  | SseCompressionEvent
  | SseSandboxEvent;

export const SSE_EVENT_TYPES = [
  'text_chunk',
  'reasoning_chunk',
  'tool_start',
  'tool_result',
  'tool_approval_request',
  'turn_complete',
  'error',
  'status_change',
  'plan_update',
  'compression',
  'sandbox',
] as const;

export type SseEventType = (typeof SSE_EVENT_TYPES)[number];

export function isSseEvent(value: unknown): value is SseEvent {
  if (!value || typeof value !== 'object') return false;
  const type = (value as SseBaseEvent).type;
  return typeof type === 'string' && SSE_EVENT_TYPES.includes(type as SseEventType);
}

export function isSseTextChunkEvent(event: SseEvent): event is SseTextChunkEvent {
  return event.type === 'text_chunk';
}

export function isSseReasoningChunkEvent(event: SseEvent): event is SseReasoningChunkEvent {
  return event.type === 'reasoning_chunk';
}

export function isSseToolStartEvent(event: SseEvent): event is SseToolStartEvent {
  return event.type === 'tool_start';
}

export function isSseToolResultEvent(event: SseEvent): event is SseToolResultEvent {
  return event.type === 'tool_result';
}

export function isSseToolApprovalRequestEvent(event: SseEvent): event is SseToolApprovalRequestEvent {
  return event.type === 'tool_approval_request';
}

export function isSseTurnCompleteEvent(event: SseEvent): event is SseTurnCompleteEvent {
  return event.type === 'turn_complete';
}

export function isSseErrorEvent(event: SseEvent): event is SseErrorEvent {
  return event.type === 'error';
}

export function isSseStatusChangeEvent(event: SseEvent): event is SseStatusChangeEvent {
  return event.type === 'status_change';
}

export function isSsePlanUpdateEvent(event: SseEvent): event is SsePlanUpdateEvent {
  return event.type === 'plan_update';
}

export function isSseCompressionEvent(event: SseEvent): event is SseCompressionEvent {
  return event.type === 'compression';
}

export function isSseSandboxEvent(event: SseEvent): event is SseSandboxEvent {
  return event.type === 'sandbox';
}
