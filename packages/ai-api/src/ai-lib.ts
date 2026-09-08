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
import { AiLibError, AiLibOptions, AiLibSubscription, StreamStatusEnum, SendMessageStreamOptions, ConnectSessionEventsOptions } from './types';
import { Logger } from './logger';
import {
  asAPIException,
  createAPIExceptionFromResponse,
  normalizeRequestError,
  parseErrorResponse,
} from './api-request';
import { buildAuthHeaders, buildMessageStreamUrl, buildSessionEventsUrl, safeParse } from './utils';

interface ResolvedStreamOptions {
  url: string;
  headers: Record<string, string>;
  method: 'POST' | 'PUT';
  body?: string;
}

type StreamCloseReason =
  | 'manual'
  | 'remote_close'
  | 'stream_error'
  | 'session_error'
  | 'http_error';

interface CloseStreamOptions {
  streamStatus?: StreamStatusEnum;
  error?: AiLibError;
  notify?: boolean;
  reason?: StreamCloseReason;
}

export class AiLib {
  #baseUrl: string;
  #apiKey?: string;
  #defaultSessionId?: string;
  #streamPath: string;
  #eventsPath: string;
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
  #streamGeneration = 0;
  /** Keeps aborting the in-flight fetch until its promise settles (controller may already be nulled). */
  #inflightAbortController: AbortController | null = null;
  #openTime: number | null = null;
  #lastEventTime: number | null = null;
  #lastEventType: string | null = null;
  #eventCount = 0;
  #currentStreamUrl: string | null = null;

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
    const { loggerUrl, baseUrl, apiKey, sessionId, streamPath, eventsPath, acceptEventTypes } = options;

    this.#baseUrl = baseUrl;
    this.#apiKey = apiKey;
    this.#defaultSessionId = sessionId;
    this.#streamPath = streamPath ?? '/api/sessions/messages/stream';
    this.#eventsPath = eventsPath ?? '/api/sessions/events';

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

  #resetStreamMetrics(url: string) {
    this.#openTime = null;
    this.#lastEventTime = null;
    this.#lastEventType = null;
    this.#eventCount = 0;
    this.#currentStreamUrl = url;
  }

  #recordSseEvent(event: SseEvent) {
    this.#lastEventTime = Date.now();
    this.#lastEventType = event.type;
    this.#eventCount += 1;
  }

  #streamDurationMs(): number | undefined {
    if (this.#startTime == null) return undefined;
    return Date.now() - this.#startTime;
  }

  #sinceLastEventMs(): number | undefined {
    if (this.#lastEventTime == null) return undefined;
    return Date.now() - this.#lastEventTime;
  }

  #logStreamDiagnostic(
    action: string,
    reason: StreamCloseReason | 'open',
    extra?: Record<string, string | undefined>
  ) {
    this.#logger.info({
      action,
      info: {
        trace_id: this.#traceId ?? undefined,
        reason,
        url: this.#currentStreamUrl ?? undefined,
        last_event_type: this.#lastEventType ?? undefined,
        session_status: this.#sessionStatus ?? undefined,
        stream_status: this.#streamStatus,
        manual_disconnect: String(this.#isManualDisconnect),
        ...extra,
      },
      stats: {
        stream_duration_ms: this.#streamDurationMs(),
        since_last_event_ms: this.#sinceLastEventMs(),
        open_duration_ms:
          this.#openTime == null ? undefined : Date.now() - this.#openTime,
        event_count: this.#eventCount,
        connecting_times: this.#connectingTimes,
      },
    });
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
      method: 'POST',
      body: JSON.stringify({
        message,
        variables: incomingOptions.variables,
        attachments,
      }),
    };
  }

  #resolveSessionEventsOptions(incomingOptions: ConnectSessionEventsOptions = {}): ResolvedStreamOptions {
    const sessionId = incomingOptions.sessionId ?? this.#defaultSessionId;
    if (!sessionId) {
      throw new Error('sessionId is required to connect session events');
    }

    const apiKey = incomingOptions.apiKey ?? this.#apiKey;
    const headers = buildAuthHeaders(apiKey, {
      Accept: 'text/event-stream',
      ...incomingOptions.headers,
    });

    return {
      url: buildSessionEventsUrl(this.#baseUrl, sessionId, this.#eventsPath),
      headers,
      method: 'PUT',
    };
  }

  #shouldAcceptEvent(event: SseEvent): boolean {
    if (!this.#acceptEventTypes) return true;
    return this.#acceptEventTypes.includes(event.type as SseEventType);
  }

  #handleSseEvent(event: SseEvent) {
    if (!this.#shouldAcceptEvent(event)) return;

    this.#recordSseEvent(event);

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
      this.#teardownStream({
        streamStatus: StreamStatusEnum.ERROR,
        error: {
          errorCode: 'session_error',
          errorMessage: 'Session entered error state',
        },
        reason: 'session_error',
      });
    }
  }

  #teardownStream(options: CloseStreamOptions = {}) {
    const {
      streamStatus = StreamStatusEnum.CLOSED,
      error = null,
      notify = true,
      reason = 'remote_close',
    } = options;

    const hadActiveStream = this.#abortController !== null || this.#streamPromise !== null;
    const wasManualDisconnect = this.#isManualDisconnect || reason === 'manual';
    this.#isManualDisconnect = true;

    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    if (this.#inflightAbortController) {
      this.#inflightAbortController.abort();
      this.#inflightAbortController = null;
    }

    this.#streamPromise = null;

    if (!hadActiveStream) {
      if (error) {
        this.#setError(error);
      }
      return;
    }

    this.#streamGeneration += 1;

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
    this.#logStreamDiagnostic('SSE_STREAM_END', reason, {
      close_stream_status: streamStatus,
      was_manual_disconnect: String(wasManualDisconnect),
      error_code: error?.errorCode != null ? String(error.errorCode) : undefined,
      error_message: error?.errorMessage ?? undefined,
    });

    if (notify && hadActiveStream) {
      this.#notifyDisconnect();
    }
  }

  #handleStreamError(error: Error, reason: StreamCloseReason = 'stream_error') {
    if (this.#isManualDisconnect) return;

    this.#logStreamDiagnostic('SSE_STREAM_ERROR', reason, {
      error_name: error.name,
      error_message: error.message,
    });

    this.#logger.exception(error, {
      action: 'SSE_ERROR',
      info: {
        traceId: this.#traceId!,
        reason,
        last_event_type: this.#lastEventType ?? undefined,
      },
      stats: {
        stream_duration_ms: this.#streamDurationMs(),
        since_last_event_ms: this.#sinceLastEventMs(),
        event_count: this.#eventCount,
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

  #finishStream(options: Omit<CloseStreamOptions, 'streamStatus'> = {}) {
    this.#teardownStream({ notify: options.notify, reason: options.reason });
  }

  #beginStream(streamOptions: ResolvedStreamOptions, logAction: string) {
    // Single SSE slot: abort any in-flight POST stream or PUT events before opening the next one.
    const hadActiveStream = this.#abortController !== null || this.#streamPromise !== null;
    this.#teardownStream({ notify: false, reason: 'manual' });

    this.#startTime = Date.now();
    this.#traceId = uuid();
    this.#isManualDisconnect = false;
    const streamGeneration = hadActiveStream ? this.#streamGeneration : ++this.#streamGeneration;
    const abortController = new AbortController();
    this.#abortController = abortController;
    this.#inflightAbortController = abortController;
    this.#resetStreamMetrics(streamOptions.url);

    this.#logger.info({
      action: logAction,
      info: {
        traceId: this.#traceId!,
        url: streamOptions.url,
        method: streamOptions.method,
        headers: JSON.stringify(streamOptions.headers),
        body: streamOptions.body,
      },
      stats: {
        startTime: this.#startTime,
      },
    });

    this.#setStreamStatus(StreamStatusEnum.CONNECTING);
    this.#setError(null);

    this.#streamPromise = this.#startStream(streamOptions, streamGeneration);
  }

  sendMessage(incomingOptions: SendMessageStreamOptions) {
    const streamOptions = this.#resolveStreamOptions(incomingOptions);
    this.#beginStream(streamOptions, 'SSE_START');
  }

  connectSessionEvents(incomingOptions: ConnectSessionEventsOptions = {}) {
    const streamOptions = this.#resolveSessionEventsOptions(incomingOptions);
    this.#beginStream(streamOptions, 'SSE_SESSION_EVENTS_START');
  }

  async #startStream(streamOptions: ResolvedStreamOptions, streamGeneration: number) {
    const abortController = this.#abortController;
    if (!abortController) return;

    const isCurrentStream = () => streamGeneration === this.#streamGeneration;

    try {
      await fetchEventSource(streamOptions.url, {
        method: streamOptions.method,
        headers: {
          ...streamOptions.headers,
          'x-trace-id': this.#traceId!,
        },
        body: streamOptions.body,
        signal: abortController.signal,
        openWhenHidden: true,
        onopen: async (response) => {
          if (!isCurrentStream()) return;

          if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
            this.#connectingTimes++;
            this.#openTime = Date.now();
            this.#setStreamStatus(StreamStatusEnum.OPEN);
            this.#setError(null);
            this.#logStreamDiagnostic('SSE_OPEN', 'open', {
              status: String(response.status),
              content_type: response.headers.get('content-type') ?? undefined,
            });
            this.#notifyOpen();
            return;
          }

          const errorData = await parseErrorResponse(response);
          this.#logStreamDiagnostic('SSE_HTTP_ERROR', 'http_error', {
            status: String(response.status),
            status_text: response.statusText,
            error: errorData.error,
            message: errorData.message,
          });
          throw createAPIExceptionFromResponse(response, response.url, errorData);
        },
        onmessage: (message) => {
          if (!isCurrentStream() || !message.data) return;

          const parsed = safeParse<unknown>(message.data);
          if (!isSseEvent(parsed)) return;

          this.#handleSseEvent(parsed);
        },
        onclose: () => {
          if (!isCurrentStream()) return;
          this.#finishStream({ notify: true, reason: 'remote_close' });
        },
        onerror: (error) => {
          if (!isCurrentStream() || this.#isManualDisconnect) {
            throw error;
          }

          this.#handleStreamError(
            normalizeRequestError(error, streamOptions.url, 'SSE stream failed'),
            'stream_error'
          );
          this.#finishStream({ notify: false, reason: 'stream_error' });
          throw error;
        },
      });
    } catch (error) {
      if (!isCurrentStream()) return;
      if (this.#isManualDisconnect) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;

      this.#handleStreamError(
        normalizeRequestError(error, streamOptions.url, 'SSE stream failed'),
        'stream_error'
      );
      this.#finishStream({ notify: false, reason: 'stream_error' });
    } finally {
      if (this.#inflightAbortController === abortController) {
        this.#inflightAbortController = null;
      }
    }
  }

  disconnect() {
    this.#logger.info({
      action: 'SSE_DISCONNECTING...',
      info: {
        traceId: this.#traceId!,
      },
    });
    this.#teardownStream({ notify: true, reason: 'manual' });
  }

  destroy() {
    this.disconnect();
    this.#sessionStatus = null;
    this.#setStreamStatus(StreamStatusEnum.IDLE);
    this.#setError(null);
    this.#subscribers.clear();
  }
}
