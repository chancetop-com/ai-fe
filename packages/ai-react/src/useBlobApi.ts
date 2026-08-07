import { useMemo, useState } from 'react';
import { BlobApi, BlobApiOptions } from '@connexup/ai-api';

export function useBlobApi(options: BlobApiOptions) {
  const [blobApi] = useState(
    () =>
      new BlobApi({
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
        fetch: options.fetch,
        headers: options.headers,
      })
  );

  return useMemo(() => blobApi, [blobApi]);
}
