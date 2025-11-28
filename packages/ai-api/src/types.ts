import { EventSource } from 'eventsource';

export interface BaseRequestOption {
  baseUrl: string;
  customHeaders?: Record<string, string>;
}

export interface RequestOptions<T> {
  url: string;
  customHeaders?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT';
  payload?: T;
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
    loggerAppName?: string;
    loggerUrl?: string;
  };

export interface AiLibState {
  status: EventSourceStatus;
  message: null | Record<string, any>;
  error: null | {
    errorCode: null | string | number;
    errorMessage: null | string;
  };
  allMessages: Record<string, any>[];
}

export interface EditorEvents {
  update: {
    eventsource: EventSource | null;
    aiLibState: AiLibState;
  };
}
