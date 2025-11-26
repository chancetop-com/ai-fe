import { EventSource, type EventSourceEventMap } from 'eventsource';
import { EventEmitter } from './EventEmitter';
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
    message: null,
    error: null,
    allMessages: [],
  };
  #ajaxController: AbortController | undefined;
  #getRequestOptions(incomingOptions: RequestOptions<T>): RequestOptions<T> {
    return mergeRequestOptions(this.#baseRequestOptions, incomingOptions);
  }

  #onOpen?: SSEListeners['onOpen'];
  #onMessage?: SSEListeners['onMessage'];
  #onError?: SSEListeners['onError'];
  #onDisconnect?: SSEListeners['onDisconnect'];

  public get aiLibState(): AiLibState {
    return this.#aiLibState;
  }

  constructor(options: AiLibOptions) {
    super();
    const {
      actionPrefix,
      baseUrl,
      customHeaders,
      logResponse,
      onOpen,
      onMessage,
      onError,
      onDisconnect,
    } = options;

    this.#baseRequestOptions = {
      baseUrl,
      customHeaders,
    };

    this.#onOpen = onOpen;
    this.#onMessage = onMessage;
    this.#onError = onError;
    this.#onDisconnect = onDisconnect;
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

  #handleOpen = (e: EventSourceEventMap['open']) => {
    // onopen callback may be called many times by EventSource auto-retry
    this.#startTime = null;
    this.#connectingTimes++;

    this.#eventSource?.addEventListener('message', this.#handleMessage);
    this.#eventSource?.addEventListener('error', this.#handleError);

    this.#updateState({
      status: 'open',
      message: null,
      error: null,
    });

    console.log(`-------SSE open ${this.#connectingTimes} times`);

    this.#onOpen?.();
  };

  #handleMessage = (e: EventSourceEventMap['message']) => {
    console.log(
      `-------SSE receive message ${e.data}, origin is ${e.origin}, lastEventId is ${e.lastEventId}`
    );

    const message = safeParse(e.data);

    if (!message) return;
    if (message.type === 'end') {
      this.#disconnectUseEventSource();
      return;
    }
    if (
      message.type === 'agent_response' ||
      message.type === 'menu_table' ||
      message.type === 'menu_preview'
    ) {
      this.#updateState({
        message:
          message.content || message.table_config || message.preview_config,
        allMessages: [...this.#aiLibState.allMessages, message.content],
        error: null,
      });

      this.#onMessage?.(message);
    }
  };

  #handleError = (e: EventSourceEventMap['error']) => {
    console.error(`-------SSE error ${e}`);

    this.#updateState({
      status: 'error',
      message: null,
      error: e.message,
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

    console.log(`-------SSE start connect at ${this.#startTime}`);

    const mergeOptions = this.#getRequestOptions(incomingOptions);

    if (mergeOptions.streaming !== undefined && !mergeOptions.streaming) {
      return this.#useFetch(mergeOptions);
    } else {
      return this.#useEventSource(mergeOptions);
    }
  }

  #useEventSource(requestOptions: RequestOptions<T>) {
    const { url, method = 'GET', customHeaders = {}, payload } = requestOptions;
    this.#eventSource = new EventSource(url, {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          method,
          body: payload ? JSON.stringify(payload) : null,
          headers: {
            'content-type': 'application/json',
            ...customHeaders,
            ...init?.headers,
            'x-trace-id': this.#traceId!,
          },
        }),
    });
    this.#updateState({
      status: 'connecting',
      message: null,
      error: null,
    });

    this.#eventSource.addEventListener('open', this.#handleOpen);
  }

  #useFetch(requestOptions: RequestOptions<T>) {
    this.#ajaxController = new AbortController();
    this.#connectingTimes = 1;
    this.#updateState({
      status: 'open',
      message: null,
      error: null,
    });

    console.log(`-------SSE open ${this.#connectingTimes} times`);

    this.#onOpen?.();

    const { url, method, customHeaders = {}, payload } = requestOptions;
    fetch(url, {
      method,
      body: payload ? JSON.stringify(payload) : null,
      headers: {
        'content-type': 'application/json',
        ...customHeaders,
        'x-trace-id': this.#traceId!,
      },
      signal: this.#ajaxController.signal,
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          return res.json().then((json) => {
            throw new Error(
              json.error_message || json.message || res.statusText
            );
          });
        }
      })
      .then(async (data) => {
        this.#updateState({
          message: data,
          allMessages: [...this.#aiLibState.allMessages, data],
          error: null,
        });
        this.#onMessage?.(data);
      })
      .catch((e) => {
        // We expect abort errors when the user manually calls `close()` - ignore those
        if (e.name === 'AbortError' || e.type === 'aborted') {
          return;
        }

        console.error(`-------SSE error ${e}`);

        this.#updateState({
          message: null,
          status: 'error',
          error: e.message,
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
      console.log(`------SSE disconnecting...`);
      this.#eventSource.removeEventListener('open', this.#handleOpen);
      this.#eventSource.removeEventListener('message', this.#handleMessage);
      this.#eventSource.removeEventListener('error', this.#handleError);
      this.#eventSource.close();
      // close 之后 readyState 会变为 CLOSED
      this.#updateState({
        status: 'closed',
      });
      console.log(`------SSE disconnected`);
      this.#onDisconnect?.();
    }
  }

  #disconnectUseFetch() {
    if (this.#ajaxController) {
      console.log(`------SSE disconnecting...`);
      this.#ajaxController.abort();
      this.#ajaxController = undefined;
      this.#updateState({
        status: 'closed',
      });
      console.log(`------SSE disconnected`);
      this.#onDisconnect?.();
    }
  }

  destroy() {
    this.disconnect();
    this.#eventSource = null;
    this.#updateState({
      status: 'idle',
      message: null,
      error: null,
      allMessages: [],
    });
    this.removeAllListeners();
  }
}
