import { useMemo, useState } from 'react';
import { FileApi, FileApiOptions } from '@connexup/ai-api';

export function useFileApi(options: FileApiOptions) {
  const [fileApi] = useState(
    () =>
      new FileApi({
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
        fetch: options.fetch,
        headers: options.headers,
      })
  );

  return useMemo(() => fileApi, [fileApi]);
}
