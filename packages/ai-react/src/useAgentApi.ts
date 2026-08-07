import { useMemo } from 'react';
import { AgentApi, AgentApiOptions } from '@connexup/ai-api';

export function useAgentApi(options: AgentApiOptions) {
  return useMemo(
    () =>
      new AgentApi({
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
        fetch: options.fetch,
        headers: options.headers,
      }),
    [options.apiKey, options.baseUrl, options.fetch, options.headers]
  );
}
