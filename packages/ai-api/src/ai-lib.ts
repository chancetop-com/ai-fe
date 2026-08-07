import { fetchEventSource } from '@microsoft/fetch-event-source';
import { v4 as uuid } from 'uuid';
import {
  isSseErrorEvent,
  isSseEvent,
  isSseStatusChangeEvent,
  SseEvent,
  SseEventType,
  SessionStatus,
} from './sse-events';
import { AiLibError, AiLibOptions, AiLibSubscription, StreamStatusEnum, SendMessageStreamOptions } from './types';
import { Logger } from './logger';
import {
  asAPIException,
  createAPIExceptionFromResponse,
  normalizeRequestError,
  parseErrorResponse,
} from './api-request';
import { buildAuthHeaders, buildMessageStreamUrl, safeParse } from './utils';

interface ResolvedStreamOptions {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export class AiLib {
  #baseUrl: string;
  #apiKey?: string;
  #defaultSessionId?: string;
  #streamPath: string;
  #abortController: AbortController | null = null;
  #startTime: number | null = null;
  #connectingTimes = 0;
  #traceId: string | null = null;
  #streamStatus: StreamStatusEnum = StreamStatusEnum.IDLE;
  #sessionStatus: SessionStatus | null = null;
  #error: AiLibError = null;
  #subscribers = new Set<AiLibSubscription>();

  #logger: Logger;
  #acceptEventTypes: SseEventType[] | null = null;
  #isManualDisconnect = false;
  #streamPromise: Promise<void> | null = null;

  public get streamStatus(): StreamStatusEnum {
    return this.#streamStatus;
  }

  public get sessionStatus(): SessionStatus | null {
    return this.#sessionStatus;
  }

  public get error(): AiLibError {
    return this.#error;
  }

  setApiKey(apiKey: string | undefined) {
    this.#apiKey = apiKey;
  }

  constructor(options: AiLibOptions) {
    const { loggerUrl, baseUrl, apiKey, sessionId, streamPath, acceptEventTypes } = options;

    this.#baseUrl = baseUrl;
    this.#apiKey = apiKey;
    this.#defaultSessionId = sessionId;
    this.#streamPath = streamPath ?? '/api/sessions/messages/stream';

    this.#logger = new Logger(loggerUrl || '');
    this.#acceptEventTypes = acceptEventTypes ?? null;
  }

  subscribe(handlers: AiLibSubscription): () => void {
    this.#subscribers.add(handlers);
    return () => {
      this.#subscribers.delete(handlers);
    };
  }

  #notifyOpen() {
    for (const subscriber of this.#subscribers) {
      subscriber.onOpen?.();
    }
  }

  #notifyMessage(event: SseEvent) {
    for (const subscriber of this.#subscribers) {
      subscriber.onMessage?.(event);
    }
  }

  #notifyError(error: Error) {
    for (const subscriber of this.#subscribers) {
      subscriber.onError?.(error);
    }
  }

  #notifyDisconnect() {
    for (const subscriber of this.#subscribers) {
      subscriber.onDisconnect?.();
    }
  }

  #setStreamStatus(streamStatus: StreamStatusEnum) {
    this.#streamStatus = streamStatus;
  }

  #setError(error: AiLibError) {
    this.#error = error;
  }

  #resolveStreamOptions(incomingOptions: SendMessageStreamOptions): ResolvedStreamOptions {
    const sessionId = incomingOptions.sessionId ?? this.#defaultSessionId;
    if (!sessionId) {
      throw new Error('sessionId is required to stream messages');
    }

    const message = incomingOptions.message?.trim() ?? '';
    const attachments = incomingOptions.attachments;
    if (!message && (!attachments || attachments.length === 0)) {
      throw new Error('message or attachments is required to stream messages');
    }

    const apiKey = incomingOptions.apiKey ?? this.#apiKey;
    const headers = buildAuthHeaders(apiKey, {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...incomingOptions.headers,
    });

    return {
      url: buildMessageStreamUrl(this.#baseUrl, sessionId, this.#streamPath),
      headers,
      body: JSON.stringify({
        message,
        variables: incomingOptions.variables,
        attachments,
      }),
    };
  }

  #shouldAcceptEvent(event: SseEvent): boolean {
    if (!this.#acceptEventTypes) return true;
    return this.#acceptEventTypes.includes(event.type as SseEventType);
  }

  #handleSseEvent(event: SseEvent) {
    if (!this.#shouldAcceptEvent(event)) return;

    if (isSseStatusChangeEvent(event)) {
      this.#sessionStatus = event.status;
    }

    if (isSseErrorEvent(event)) {
      this.#setError({
        errorCode: 'sse_error',
        errorMessage: event.message,
      });
      this.#logger.info({
        action: 'SSE_EVENT_ERROR',
        info: {
          traceId: this.#traceId!,
          message: event.message,
          detail: event.detail,
        },
      });
    }

    this.#setStreamStatus(StreamStatusEnum.OPEN);
    this.#notifyMessage(event);

    if (isSseStatusChangeEvent(event) && event.status === 'error') {
      this.#closeStream({
        streamStatus: StreamStatusEnum.ERROR,
        error: {
          errorCode: 'session_error',
          errorMessage: 'Session entered error state',
        },
      });
    }
  }

  #closeStream(options?: { streamStatus?: StreamStatusEnum; error?: AiLibError; notify?: boolean }) {
    const { streamStatus = StreamStatusEnum.CLOSED, error = null, notify = true } = options ?? {};

    this.#isManualDisconnect = true;

    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    this.#streamPromise = null;
    this.#setStreamStatus(streamStatus);
    if (error) {
      this.#setError(error);
    }

    this.#logger.info({
      action: 'SSE_DISCONNECTED',
      info: {
        traceId: this.#traceId!,
        streamStatus,
      },
    });

    if (notify) {
      this.#notifyDisconnect();
    }
  }

  #handleStreamError(error: Error) {
    if (this.#isManualDisconnect) return;

    this.#logger.exception(error, {
      action: 'SSE_ERROR',
      info: {
        traceId: this.#traceId!,
      },
    });

    this.#setStreamStatus(StreamStatusEnum.ERROR);
    const apiError = asAPIException(error);
    this.#setError({
      errorCode: apiError?.errorCode ?? 'network_error',
      errorMessage: apiError?.message ?? error.message,
    });
    this.#notifyError(apiError ?? error);
  }

  #finishStream(shouldNotify = true) {
    this.#closeStream({ notify: shouldNotify });
  }

  sendMessage(incomingOptions: SendMessageStreamOptions) {
    if (this.#streamPromise) {
      this.disconnect();
    }

    this.#startTime = Date.now();
    this.#traceId = uuid();
    this.#isManualDisconnect = false;
    this.#abortController = new AbortController();

    const streamOptions = this.#resolveStreamOptions(incomingOptions);

    this.#logger.info({
      action: 'SSE_START',
      info: {
        traceId: this.#traceId!,
        url: streamOptions.url,
        method: 'POST',
        headers: JSON.stringify(streamOptions.headers),
        body: streamOptions.body,
      },
      stats: {
        startTime: this.#startTime,
      },
    });

    this.#setStreamStatus(StreamStatusEnum.CONNECTING);
    this.#setError(null);

    this.#streamPromise = this.#startStream(streamOptions);
  }

  async #startStream(streamOptions: ResolvedStreamOptions) {
    const abortController = this.#abortController;
    if (!abortController) return;

    try {
      await fetchEventSource(streamOptions.url, {
        method: 'POST',
        headers: {
          ...streamOptions.headers,
          'x-trace-id': this.#traceId!,
        },
        body: streamOptions.body,
        signal: abortController.signal,
        openWhenHidden: true,
        onopen: async (response) => {
          if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
            this.#connectingTimes++;
            this.#setStreamStatus(StreamStatusEnum.OPEN);
            this.#setError(null);
            this.#notifyOpen();
            return;
          }

          const errorData = await parseErrorResponse(response);
          throw createAPIExceptionFromResponse(response, response.url, errorData);
        },
        onmessage: (message) => {
          if (!message.data) return;

          const parsed = safeParse<unknown>(message.data);
          if (!isSseEvent(parsed)) return;

          this.#handleSseEvent(parsed);
        },
        onclose: () => {
          this.#finishStream(true);
        },
        onerror: (error) => {
          if (this.#isManualDisconnect) {
            throw error;
          }

          this.#handleStreamError(normalizeRequestError(error, streamOptions.url, 'SSE stream failed'));
          this.#finishStream(false);
          throw error;
        },
      });
    } catch (error) {
      if (this.#isManualDisconnect) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;

      this.#handleStreamError(normalizeRequestError(error, streamOptions.url, 'SSE stream failed'));
      this.#finishStream(false);
    }
  }

  disconnect() {
    this.#logger.info({
      action: 'SSE_DISCONNECTING...',
      info: {
        traceId: this.#traceId!,
      },
    });
    this.#closeStream();
  }

  destroy() {
    this.disconnect();
    this.#sessionStatus = null;
    this.#setStreamStatus(StreamStatusEnum.IDLE);
    this.#setError(null);
    this.#subscribers.clear();
  }
}
