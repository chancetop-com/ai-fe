import deepEqual from 'fast-deep-equal/es6/react.js';
import { useDebugValue, useEffect, useLayoutEffect, useState } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { AiLib } from '@connexup/ai-api';
import { AiLibStateSnapshot, UseAiLibStateOptions } from './types';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export class AiLibStoreManager<TAiLib extends AiLib | null = AiLib | null> {
  private aiLib: TAiLib;
  private lastSnapshot: AiLibStateSnapshot = {
    status: 'idle',
    message: null,
    error: null,
    allMessages: [],
  };

  private subscribers = new Set<() => void>();
  constructor(initialAiLib: TAiLib) {
    this.aiLib = initialAiLib;

    this.getSnapshot = this.getSnapshot.bind(this);
    this.getServerSnapshot = this.getServerSnapshot.bind(this);
    this.watch = this.watch.bind(this);
    this.subscribe = this.subscribe.bind(this);
  }

  getSnapshot(): AiLibStateSnapshot {
    if (this.aiLib) {
      this.lastSnapshot = this.aiLib.aiLibState;
    }
    return this.lastSnapshot;
  }

  getServerSnapshot(): AiLibStateSnapshot {
    return this.lastSnapshot;
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  watch(aiLib: TAiLib): undefined | (() => void) {
    this.aiLib = aiLib;

    if (this.aiLib) {
      const fn = () => {
        this.subscribers.forEach((callback) => callback());
      };

      const currentAiLib = this.aiLib;

      currentAiLib.on('update', fn);
      return () => {
        currentAiLib.off('update', fn);
      };
    }

    return undefined;
  }
}

export function useAiLibState<TSelectorResult>(
  options: UseAiLibStateOptions<TSelectorResult, AiLib>
): TSelectorResult;

export function useAiLibState<TSelectorResult>(
  options: UseAiLibStateOptions<TSelectorResult, AiLib | null>
): TSelectorResult | null;

export function useAiLibState<TSelectorResult>(
  options:
    | UseAiLibStateOptions<TSelectorResult, AiLib>
    | UseAiLibStateOptions<TSelectorResult, AiLib | null>
): TSelectorResult | null {
  const [aiLibStoreManager] = useState(
    () => new AiLibStoreManager(options.aiLib)
  );

  const selectedState = useSyncExternalStoreWithSelector(
    aiLibStoreManager.subscribe,
    aiLibStoreManager.getSnapshot,
    aiLibStoreManager.getServerSnapshot,
    options.selector as UseAiLibStateOptions<
      TSelectorResult,
      AiLib | null
    >['selector'],
    options.equalityFn ?? deepEqual
  );

  useIsomorphicLayoutEffect(() => {
    return aiLibStoreManager.watch(options.aiLib);
  }, [options.aiLib, aiLibStoreManager]);

  useDebugValue(selectedState);

  return selectedState;
}
