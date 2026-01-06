import { EventSource } from 'eventsource';

export interface BaseRequestOption {
  baseUrl?: string;
}

export interface RequestOptions<T> {
  url?: string;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT';
  pathParams?: Record<string, string>;
  data?: T;
  streaming?: boolean;
}

export enum EventSourceStatusEnum {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSED = 'closed',
  ERROR = 'error',
}

export type AiLibError = null | {
  errorCode: null | string | number;
  errorMessage: null | string;
};

export interface SSEListeners {
  // onNotice?: (event: Event) => void;
  // onUpdate?: (event: Event) => void;
  onOpen: () => void;
  onMessage: (data: any) => void;
  onError: (event: Event) => void;
  onDisconnect: () => void;
}

export type AiLibOptions = BaseRequestOption &
  Partial<SSEListeners> & {
    loggerUrl?: string;
    retryAttempts?: number; // default 3
    acceptMsgTypes?: string[];
  };

export interface AiLibState {
  status: EventSourceStatusEnum;
  streamMessage: null | Record<string, any>;
  fullMessages: Record<string, any>[];
  error: AiLibError;
  // allMessages: Record<string, any>[];
}

export interface EditorEvents {
  update: {
    eventsource: EventSource | null;
    aiLibState: AiLibState;
  };
}

export enum MsgTypeEnum {
  End = 'end',
  AgentResponse = 'agent_response',
}
