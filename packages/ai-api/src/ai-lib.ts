import { EventSource } from 'eventsource';
import { EventEmitter } from './event-emitter';
import { v4 as uuid } from 'uuid';
import { mergeRequestOptions, safeParse } from './utils';
import {
  AiLibOptions,
  AiLibState,
  BaseRequestOption,
  EditorEvents,
  RequestOptions,
  SSEListeners,
} from './types';
import { Logger } from './logger';
import { APIException, NetworkConnectionException } from './exception';

export class AiLib<
  T extends Record<string, any> = any,
> extends EventEmitter<EditorEvents> {
  #baseRequestOptions: BaseRequestOption;
  #eventSource: EventSource | null = null;
  #startTime: number | null = null;
  #connectingTimes: number = 0;
  #traceId: string | null = null;
  #aiLibState: AiLibState = {
    status: 'idle',
    streamMessage: null,
    fullMessages: [],
    error: null,
    // allMessages: [],
  };
  #ajaxController: AbortController | undefined;
  #getRequestOptions(incomingOptions: RequestOptions<T>): RequestOptions<T> {
    return mergeRequestOptions(this.#baseRequestOptions, incomingOptions);
  }

  #onOpen?: SSEListeners['onOpen'];
  #onMessage?: SSEListeners['onMessage'];
  #onError?: SSEListeners['onError'];
  #onDisconnect?: SSEListeners['onDisconnect'];

  #logger: Logger;

  public get aiLibState(): AiLibState {
    return this.#aiLibState;
  }

  constructor(options: AiLibOptions) {
    super();
    const { loggerUrl, baseUrl, onOpen, onMessage, onError, onDisconnect } =
      options;

    this.#baseRequestOptions = {
      baseUrl,
    };

    this.#onOpen = onOpen;
    this.#onMessage = onMessage;
    this.#onError = onError;
    this.#onDisconnect = onDisconnect;

    this.#logger = new Logger(loggerUrl || '');
  }

  #updateState(state: Partial<AiLibState>) {
    this.#aiLibState = {
      ...this.#aiLibState,
      ...state,
    };

    this.emit('update', {
      eventsource: this.#eventSource,
      aiLibState: this.#aiLibState,
    });
  }

  #handleOpen = (e: Event) => {
    this.#logger.info({
      action: 'SSE_OPEN',
      info: {
        traceId: this.#traceId!,
        url: (e.target as EventSource).url,
        eventsourceState: `${(e.target as EventSource).readyState}`,
      },
      stats: {
        connectingTimes: this.#connectingTimes,
      },
    });
    // console.log('-------SSE open', e);
    // onopen callback may be called many times by EventSource auto-retry
    this.#startTime = null;
    this.#connectingTimes++;

    this.#eventSource?.addEventListener('message', this.#handleMessage);
    this.#eventSource?.addEventListener('error', this.#handleError);

    this.#updateState({
      status: 'open',
      streamMessage: null,
      error: null,
    });

    this.#logger.info({
      action: 'SSE_OPEN',
      info: {
        traceId: this.#traceId!,
      },
      stats: {
        connectingTimes: this.#connectingTimes,
      },
    });

    this.#onOpen?.();
  };

  #handleMessage = (e: EventSourceEventMap['message']) => {
    const message = safeParse(e.data);

    if (!message) return;
    if (message.type === 'end') {
      this.#disconnectUseEventSource();
      return;
    }

    // ??? todo: unify message type with backend
    if (
      message.type === 'agent_response' ||
      message.type === 'menu_table' ||
      message.type === 'menu_preview'
    ) {
      const streamMessage =
        message.content || message.table_config || message.preview_config;
      this.#updateState({
        status: 'open',
        fullMessages: [...this.#aiLibState.fullMessages, streamMessage],
        streamMessage,
        error: null,
      });

      this.#onMessage?.(message);
    }
  };

  // ??? todo: unify error data with backend
  #handleError = (e: Event) => {
    // this.#logger.error({
    //   action: 'SSE_ERROR',
    //   info: {
    //     traceId: this.#traceId!,
    //   },
    //   error_code: e.code,
    //   error_message: e.message,
    // });

    let exception: any;

    try {
      const originErrorData = safeParse((e as any).data);
      if (originErrorData.error_code) {
        exception = new APIException(
          originErrorData.error_message || `[No Response]`,
          200,
          (e.target as EventSource).url,
          originErrorData,
          originErrorData.error_id || null,
          originErrorData.error_code
        );
      } else {
        exception = new NetworkConnectionException(
          `Failed to connect: ${(e.target as EventSource).url}`,
          (e.target as EventSource).url,
          (e as any).data || 'UNKNOWN'
        );
      }
    } catch (error) {
      exception = new NetworkConnectionException(
        `Failed to connect: ${(e.target as EventSource).url}`,
        (e.target as EventSource).url,
        (e as any).data || 'UNKNOWN'
      );
    }

    this.#logger.exception(exception, {
      action: 'SSE_ERROR',
      info: {
        traceId: this.#traceId!,
      },
    });
    // console.error(`-------SSE error ${e}`);

    this.#updateState({
      status: 'error',
      streamMessage: null,
      error: {
        errorCode: exception!.errorCode,
        errorMessage: exception.message,
      },
    });

    this.#onError?.(e);
  };

  connect(incomingOptions: RequestOptions<T>) {
    const sseState = this.#eventSource?.readyState;
    if (sseState === EventSource.CONNECTING || sseState === EventSource.OPEN)
      return;

    if (this.#ajaxController) {
      return;
    }

    this.#startTime = Date.now();
    this.#traceId = uuid();

    // console.log(`-------SSE start connect at ${this.#startTime}`);

    const mergeOptions = this.#getRequestOptions(incomingOptions);

    this.#logger.info({
      action: 'SSE_START',
      info: {
        traceId: this.#traceId!,
        url: mergeOptions.url,
        method: mergeOptions.method,
        data: mergeOptions.data ? JSON.stringify(mergeOptions.data) : undefined,
        headers: JSON.stringify(mergeOptions.headers),
        streaming: (mergeOptions.streaming ?? true).toString(),
      },
      stats: {
        startTime: this.#startTime,
      },
    });

    if (mergeOptions.streaming !== undefined && !mergeOptions.streaming) {
      return this.#useFetch(mergeOptions);
    } else {
      return this.#useEventSource(mergeOptions);
    }
  }

  #useEventSource(requestOptions: RequestOptions<T>) {
    const { url, method = 'GET', headers = {}, data } = requestOptions;
    this.#eventSource = new EventSource(url!, {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          method,
          body: data ? JSON.stringify(data) : null,
          headers: {
            'content-type': 'application/json',
            ...headers,
            ...init?.headers,
            'x-trace-id': this.#traceId!,
          },
        }),
    });
    this.#updateState({
      status: 'connecting',
      streamMessage: null,
      fullMessages: [],
      error: null,
    });

    this.#eventSource.addEventListener('open', this.#handleOpen);
  }

  #useFetch(requestOptions: RequestOptions<T>) {
    this.#ajaxController = new AbortController();
    this.#connectingTimes = 1;
    this.#updateState({
      status: 'open',
      streamMessage: null,
      fullMessages: [],
      error: null,
    });

    this.#logger.info({
      action: 'SSE_OPEN_USE_FETCH',
      info: {
        traceId: this.#traceId!,
        url: requestOptions.url,
        method: requestOptions.method,
        data: requestOptions.data
          ? JSON.stringify(requestOptions.data)
          : undefined,
        headers: JSON.stringify(requestOptions.headers),
        streaming: (requestOptions.streaming ?? true).toString(),
      },
      stats: {
        connectingTimes: this.#connectingTimes,
      },
    });
    // console.log(`-------SSE open ${this.#connectingTimes} times`);

    this.#onOpen?.();

    const { url, method, headers = {}, data } = requestOptions;
    fetch(url!, {
      method,
      body: data ? JSON.stringify(data) : null,
      headers: {
        'content-type': 'application/json',
        ...headers,
        'x-trace-id': this.#traceId!,
      },
      signal: this.#ajaxController.signal,
    })
      .then(async (res) => {
        if (res.ok) {
          return res.json();
        } else {
          const responseData = await res.json();
          if (responseData.error_code) {
            throw new APIException(
              responseData.error_message || `[No Response]`,
              res.status,
              res.url,
              responseData,
              responseData?.id || null,
              responseData.error_code
            );
          } else {
            throw new NetworkConnectionException(
              `Failed to connect: ${res.url}`,
              res.url,
              `${res.statusText || 'UNKNOWN'}`
            );
          }
        }
      })
      .then(async (data) => {
        this.#updateState({
          streamMessage: data,
          fullMessages: [data],
          error: null,
        });
        this.#onMessage?.(data);
      })
      .catch((e) => {
        // We expect abort errors when the user manually calls `close()` - ignore those
        if (e.name === 'AbortError' || e.type === 'aborted') {
          return;
        }

        this.#logger.exception(e, {
          action: 'SSE_ERROR_USE_FETCH',
          info: {
            traceId: this.#traceId!,
          },
        });

        this.#updateState({
          streamMessage: null,
          fullMessages: [],
          status: 'error',
          error: {
            errorCode: e.errorCode || e.statusCode,
            errorMessage: e.message,
          },
        });
        this.#onError?.(e);
      })
      .finally(() => {
        this.#disconnectUseFetch();
      });
  }

  disconnect() {
    this.#disconnectUseEventSource();
    this.#disconnectUseFetch();
  }

  #disconnectUseEventSource() {
    if (this.#eventSource) {
      this.#logger.info({
        action: 'SSE_DISCONNECTING...',
        info: {
          traceId: this.#traceId!,
        },
      });

      this.#eventSource.removeEventListener('open', this.#handleOpen);
      this.#eventSource.removeEventListener('message', this.#handleMessage);
      this.#eventSource.removeEventListener('error', this.#handleError);
      this.#eventSource.close();
      // close 之后 readyState 会变为 CLOSED
      this.#updateState({
        status: 'closed',
      });

      this.#logger.info({
        action: 'SSE_DISCONNECTED',
        info: {
          traceId: this.#traceId!,
        },
      });
      this.#onDisconnect?.();
    }
  }

  #disconnectUseFetch() {
    if (this.#ajaxController) {
      this.#logger.info({
        action: 'SSE_DISCONNECTING_USE_FETCH...',
        info: {
          traceId: this.#traceId!,
        },
      });

      this.#ajaxController.abort();
      this.#ajaxController = undefined;
      this.#updateState({
        status: 'closed',
      });

      this.#logger.info({
        action: 'SSE_DISCONNECTED_USE_FETCH',
        info: {
          traceId: this.#traceId!,
        },
      });
      this.#onDisconnect?.();
    }
  }

  destroy() {
    this.disconnect();
    this.#eventSource = null;
    this.#updateState({
      status: 'idle',
      streamMessage: null,
      fullMessages: [],
      error: null,
      // allMessages: [],
    });
    this.removeAllListeners();
  }
}
