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

export type EventSourceStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error';

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
  };

export interface AiLibState {
  status: EventSourceStatus;
  streamMessage: null | Record<string, any>;
  fullMessages: Record<string, any>[];
  error: null | {
    errorCode: null | string | number;
    errorMessage: null | string;
  };
  // allMessages: Record<string, any>[];
}

export interface EditorEvents {
  update: {
    eventsource: EventSource | null;
    aiLibState: AiLibState;
  };
}
