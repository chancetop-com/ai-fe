import { SseEvent, SseEventType, SessionStatus } from './sse-events';
import { SendMessageRequest } from './session-api-types';

export interface AiLibOptions {
  baseUrl: string;
  apiKey?: string;
  sessionId?: string;
  streamPath?: string;
  loggerUrl?: string;
  acceptEventTypes?: SseEventType[];
}

export interface AiLibSubscription {
  onOpen?: () => void;
  onMessage?: (event: SseEvent) => void;
  onError?: (error: Error) => void;
  onDisconnect?: () => void;
}

export interface SendMessageStreamOptions extends SendMessageRequest {
  sessionId?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

export enum StreamStatusEnum {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSED = 'closed',
  ERROR = 'error',
}

/** @deprecated Use StreamStatusEnum */
export { StreamStatusEnum as EventSourceStatusEnum };

export type AiLibError = null | {
  errorCode: null | string | number;
  errorMessage: null | string;
};
