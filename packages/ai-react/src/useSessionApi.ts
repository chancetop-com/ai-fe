import { useMemo, useState } from 'react';
import { SessionApi, SessionApiOptions } from '@connexup/ai-api';

export function useSessionApi(options: SessionApiOptions) {
  const [sessionApi] = useState(
    () =>
      new SessionApi({
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
        fetch: options.fetch,
        headers: options.headers,
      })
  );

  return useMemo(() => sessionApi, [sessionApi]);
}
