import { SessionHistoryMessage, SessionStatus, SseEvent, TodoStatus, SendMessageAttachment } from '@connexup/ai-api';
import { StreamStatusEnum } from '@connexup/ai-api';
import type { AiLibError } from '@connexup/ai-api';

export interface ToolEvent {
  type: 'start' | 'result';
  tool: string;
  callId: string;
  arguments?: string;
  result?: string;
  output?: string;
  resultStatus?: string;
  toolNotes?: string;
  taskId?: string;
  runInBackground?: boolean;
  toolType?: string;
  model?: string;
  children?: ToolEvent[];
}

export interface TextSegment {
  type: 'text';
  content: string;
}

export interface ThinkingSegment {
  type: 'thinking';
  content: string;
}

export interface ToolsSegment {
  type: 'tools';
  tools: ToolEvent[];
}

export interface SandboxSegment {
  type: 'sandbox';
  sandboxType: string;
  sandboxId: string;
  message: string;
  durationMs?: number;
}

export type MessageSegment = TextSegment | ThinkingSegment | ToolsSegment | SandboxSegment;

export interface ChatAttachment {
  url: string;
  type: 'IMAGE' | 'PDF' | 'FILE' | 'VIDEO' | string;
  file_name?: string;
  content_type?: string;
}

export interface ApprovalInfo {
  callId: string;
  tool: string;
  arguments?: string;
  suggestedPattern?: string;
}

export type SystemMessageKind = 'compression' | 'error';

export interface ChatMessage {
  key: string;
  role: 'user' | 'assistant' | 'system';
  segments: MessageSegment[];
  systemKind?: SystemMessageKind;
  systemContent?: string;
  systemMetadata?: {
    beforeCount?: number;
    afterCount?: number;
    errorDetail?: string;
  };
  approval?: ApprovalInfo;
  timestamp?: string;
  streaming?: boolean;
  metadata?: {
    attachments?: ChatAttachment[];
  };
}

export interface ChatState {
  messages: ChatMessage[];
  sessionStatus: SessionStatus | null;
  streamStatus: StreamStatusEnum;
  error: AiLibError;
  isThinking: boolean;
  planTodos: Array<{ content: string; status: TodoStatus }> | null;
}

export const initialChatState: ChatState = {
  messages: [],
  sessionStatus: null,
  streamStatus: StreamStatusEnum.IDLE,
  error: null,
  isThinking: false,
  planTodos: null,
};

function hasAnySegments(segments?: MessageSegment[]): boolean {
  return Boolean(segments && segments.length > 0);
}

function ensureLastAgentMessage(messages: ChatMessage[]): {
  messages: ChatMessage[];
  index: number;
} {
  const next = [...messages];
  const last = next[next.length - 1];
  if (!last || last.role !== 'assistant') {
    next.push(createAgentPlaceholder());
    return { messages: next, index: next.length - 1 };
  }
  return { messages: next, index: next.length - 1 };
}

export function getMessageText(message: ChatMessage): string {
  return message.segments
    .filter((segment): segment is TextSegment => segment.type === 'text')
    .map((segment) => segment.content)
    .join('\n\n');
}

export function createAgentPlaceholder(): ChatMessage {
  return {
    key: `agent-${Date.now()}`,
    role: 'assistant',
    segments: [],
    streaming: true,
    timestamp: new Date().toISOString(),
  };
}

export function createUserMessage(content: string, attachments?: SendMessageAttachment[]): ChatMessage {
  const chatAttachments: ChatAttachment[] | undefined = attachments?.length
    ? attachments.map((attachment) => ({
        url: attachment.url,
        type: attachment.type,
        file_name: attachment.file_name,
        content_type: attachment.content_type,
      }))
    : undefined;

  const segments: MessageSegment[] = [];
  const trimmed = content.trim();
  if (trimmed) {
    segments.push({ type: 'text', content: trimmed });
  }

  return {
    key: `user-${Date.now()}`,
    role: 'user',
    segments,
    timestamp: new Date().toISOString(),
    metadata: chatAttachments?.length ? { attachments: chatAttachments } : undefined,
  };
}

export function reduceChatState(state: ChatState, event: SseEvent): ChatState {
  let messages = [...state.messages];
  let isThinking = state.isThinking;
  let planTodos = state.planTodos;

  switch (event.type) {
    case 'text_chunk': {
      const chunk = event.content || '';
      if (!chunk) break;

      const ensured = ensureLastAgentMessage(messages);
      messages = ensured.messages;
      const last = messages[ensured.index]!;
      const segments = [...last.segments];
      const lastSeg = segments[segments.length - 1];

      if (lastSeg?.type === 'text') {
        segments[segments.length - 1] = {
          ...lastSeg,
          content: lastSeg.content + chunk,
        };
      } else {
        const existingIdx = segments.findIndex((segment) => segment.type === 'text');
        if (existingIdx >= 0) {
          const existing = segments[existingIdx] as TextSegment;
          const updated: TextSegment = {
            type: 'text',
            content: `${existing.content}\n\n${chunk}`,
          };
          segments.splice(existingIdx, 1);
          segments.push(updated);
        } else {
          segments.push({ type: 'text', content: chunk });
        }
      }

      messages[ensured.index] = {
        ...last,
        segments,
        streaming: !event.is_final_chunk,
        timestamp: event.timestamp,
      };
      break;
    }

    case 'reasoning_chunk': {
      if (event.is_final_chunk) {
        isThinking = false;
        break;
      }

      const chunk = event.content || '';
      if (!chunk) break;

      isThinking = true;
      const ensured = ensureLastAgentMessage(messages);
      messages = ensured.messages;
      const last = messages[ensured.index]!;
      const segments = [...last.segments];
      const lastSeg = segments[segments.length - 1];

      if (lastSeg?.type === 'thinking') {
        segments[segments.length - 1] = {
          ...lastSeg,
          content: lastSeg.content + chunk,
        };
      } else {
        const existingIdx = segments.findIndex((segment) => segment.type === 'thinking');
        if (existingIdx >= 0) {
          const existing = segments[existingIdx] as ThinkingSegment;
          segments[existingIdx] = {
            ...existing,
            content: existing.content + chunk,
          };
        } else {
          segments.push({ type: 'thinking', content: chunk });
        }
      }

      messages[ensured.index] = {
        ...last,
        segments,
        streaming: true,
        timestamp: event.timestamp,
      };
      break;
    }

    case 'tool_start': {
      isThinking = false;
      const ensured = ensureLastAgentMessage(messages);
      messages = ensured.messages;
      const last = messages[ensured.index]!;
      const segments = [...last.segments];

      let toolsSeg: ToolsSegment;
      let toolsSegIdx = segments.findIndex((segment) => segment.type === 'tools');
      if (toolsSegIdx >= 0) {
        toolsSeg = segments[toolsSegIdx] as ToolsSegment;
      } else {
        toolsSeg = { type: 'tools', tools: [] };
        toolsSegIdx = segments.length;
        segments.push(toolsSeg);
      }

      const tools = [...toolsSeg.tools];
      const newTool: ToolEvent = {
        type: 'start',
        tool: event.tool_name,
        callId: event.call_id,
        arguments: event.tool_args ? JSON.stringify(event.tool_args) : undefined,
        toolNotes: event.tool_notes,
        taskId: event.task_id,
        runInBackground: event.run_in_background,
        model: event.model,
      };

      if (event.task_id) {
        const parentIdx = tools.findIndex((tool) => tool.taskId === event.task_id);
        if (parentIdx >= 0) {
          const parent = { ...tools[parentIdx]! };
          parent.children = [...(parent.children || []), newTool];
          tools[parentIdx] = parent;
          segments[toolsSegIdx] = { ...toolsSeg, tools };
          messages[ensured.index] = {
            ...last,
            segments,
            streaming: true,
            timestamp: event.timestamp,
          };
          break;
        }

        const hasOrphans = tools.some(
          (tool) => tool.taskId === event.task_id && tool.callId !== event.call_id
        );
        if (hasOrphans) {
          const orphans = tools.filter(
            (tool) => tool.taskId === event.task_id && tool.callId !== event.call_id
          );
          const remaining = tools.filter(
            (tool) => tool.taskId !== event.task_id || tool.callId === event.call_id
          );
          newTool.children = orphans;
          remaining.push(newTool);
          segments[toolsSegIdx] = { ...toolsSeg, tools: remaining };
          messages[ensured.index] = {
            ...last,
            segments,
            streaming: true,
            timestamp: event.timestamp,
          };
          break;
        }
      }

      tools.push(newTool);
      segments[toolsSegIdx] = { ...toolsSeg, tools };

      messages[ensured.index] = {
        ...last,
        segments,
        streaming: true,
        timestamp: event.timestamp,
      };
      break;
    }

    case 'tool_result': {
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        const segments = [...last.segments];
        let updated = false;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
          const segment = segments[segmentIndex];
          if (segment?.type !== 'tools') continue;
          const tools = [...segment.tools];
          const toolIndex = tools.findIndex((tool) => tool.callId === event.call_id);
          if (toolIndex >= 0) {
            const currentTool = tools[toolIndex]!;
            tools[toolIndex] = {
              ...currentTool,
              type: 'result',
              result: event.result,
              resultStatus: event.status,
              toolType: event.tool_type,
            };
            segments[segmentIndex] = { ...segment, tools };
            updated = true;
            break;
          }

          for (let parentIndex = 0; parentIndex < tools.length; parentIndex += 1) {
            const parent = tools[parentIndex]!;
            if (!parent.children) continue;
            const childIndex = parent.children.findIndex((tool) => tool.callId === event.call_id);
            if (childIndex < 0) continue;
            const children = [...parent.children];
            children[childIndex] = {
              ...children[childIndex]!,
              type: 'result',
              result: event.result,
              resultStatus: event.status,
              toolType: event.tool_type,
            };
            tools[parentIndex] = { ...parent, children };
            segments[segmentIndex] = { ...segment, tools };
            updated = true;
            break;
          }
          if (updated) break;
        }
        if (updated) {
          messages[messages.length - 1] = { ...last, segments };
        }
      }
      break;
    }

    case 'tool_approval_request': {
      isThinking = false;
      const ensured = ensureLastAgentMessage(messages);
      messages = ensured.messages;
      const last = messages[ensured.index]!;
      messages[ensured.index] = {
        ...last,
        approval: {
          callId: event.call_id,
          tool: event.tool_name,
          arguments: event.arguments,
          suggestedPattern: event.suggested_pattern,
        },
      };
      break;
    }

    case 'turn_complete': {
      isThinking = false;
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        if (event.cancelled && !hasAnySegments(last.segments)) {
          messages = messages.slice(0, -1);
        } else {
          messages[messages.length - 1] = {
            ...last,
            streaming: false,
            timestamp: event.timestamp || new Date().toISOString(),
          };
        }
      }
      break;
    }

    case 'error': {
      isThinking = false;
      const ensured = ensureLastAgentMessage(messages);
      messages = ensured.messages;
      const last = messages[ensured.index]!;
      const segments = [...last.segments, { type: 'text', content: `Error: ${event.message}` } satisfies TextSegment];
      messages[ensured.index] = {
        ...last,
        segments,
        streaming: false,
        timestamp: event.timestamp,
      };
      break;
    }

    case 'status_change': {
      return {
        ...state,
        messages,
        isThinking,
        planTodos,
        sessionStatus: event.status,
      };
    }

    case 'plan_update': {
      planTodos = event.todos;
      break;
    }

    case 'compression': {
      if (event.completed) {
        messages.push({
          key: `compression-${event.timestamp}`,
          role: 'system',
          segments: [],
          systemKind: 'compression',
          systemContent: `Compressed ${event.before_count} → ${event.after_count} messages`,
          systemMetadata: {
            beforeCount: event.before_count,
            afterCount: event.after_count,
          },
          timestamp: event.timestamp,
        });
      }
      break;
    }

    case 'sandbox': {
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        const segments = [...last.segments];
        const sandboxSeg: SandboxSegment = {
          type: 'sandbox',
          sandboxType: event.sandbox_type || '',
          sandboxId: event.sandbox_id || '',
          message: event.message || '',
          durationMs: event.duration_ms,
        };
        const existingIdx = segments.findIndex((segment) => segment.type === 'sandbox');
        if (existingIdx >= 0) {
          segments[existingIdx] = sandboxSeg;
        } else {
          segments.push(sandboxSeg);
        }
        messages[messages.length - 1] = { ...last, segments };
      }
      break;
    }

    default:
      break;
  }

  return {
    ...state,
    messages,
    isThinking,
    planTodos,
  };
}

export function applyStreamState(
  state: ChatState,
  streamStatus: StreamStatusEnum,
  error: AiLibError = null,
  sessionStatus: SessionStatus | null = state.sessionStatus
): ChatState {
  return {
    ...state,
    streamStatus,
    error,
    sessionStatus,
    isThinking:
      streamStatus === StreamStatusEnum.CLOSED || streamStatus === StreamStatusEnum.ERROR ? false : state.isThinking,
  };
}

function buildHistorySegments(item: SessionHistoryMessage): MessageSegment[] {
  const segments: MessageSegment[] = [];

  if (item.thinking) {
    segments.push({ type: 'thinking', content: item.thinking });
  }

  if (item.tools?.length) {
    segments.push({
      type: 'tools',
      tools: item.tools.map((tool) => ({
        type: 'result',
        tool: tool.name,
        callId: tool.call_id,
        arguments: tool.arguments,
        result: tool.result,
        resultStatus: tool.status,
      })),
    });
  }

  if (item.content) {
    segments.push({ type: 'text', content: item.content });
  }

  return segments;
}

export function historyToChatMessages(history: SessionHistoryMessage[]): ChatMessage[] {
  return history.map((item, index) => {
    const role = item.role === 'user' ? 'user' : 'assistant';
    return {
      key: `history-${item.seq ?? index}-${item.timestamp ?? index}`,
      role,
      segments: buildHistorySegments(item),
      timestamp: item.timestamp,
    };
  });
}
