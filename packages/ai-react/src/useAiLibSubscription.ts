import { useEffect, useRef } from 'react';
import { AiLib, SseEvent } from '@connexup/ai-api';

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export interface AiLibSubscriptionHandlers {
  onMessage?: (event: SseEvent) => void;
  onOpen?: () => void;
  onError?: (error: Error) => void;
  onDisconnect?: () => void;
}

/**
 * Subscribe to AiLib events directly. Each SSE message is delivered
 * imperatively, so no events are lost between React renders.
 */
export function useAiLibSubscription(aiLib: AiLib, handlers: AiLibSubscriptionHandlers) {
  const handlersRef = useLatestRef(handlers);

  useEffect(() => {
    return aiLib.subscribe({
      onMessage: (event) => handlersRef.current.onMessage?.(event),
      onOpen: () => handlersRef.current.onOpen?.(),
      onError: (error) => handlersRef.current.onError?.(error),
      onDisconnect: () => handlersRef.current.onDisconnect?.(),
    });
  }, [aiLib, handlersRef]);
}
