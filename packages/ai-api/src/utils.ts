export function safeParse<T = unknown>(data: string): T | null {
  try {
    return parseWithDate(data);
  } catch (e) {
    return null;
  }
}

/**
 * If an ISO format date (2018-05-24T12:00:00.123Z) appears in the JSON, it will be transformed to JS Date type.
 */
export function parseWithDate(data: string) {
  const ISO_DATE_FORMAT = /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-][01]\d:[0-5]\d)$/;
  return JSON.parse(data, (key: any, value: any) => {
    if (typeof value === 'string' && ISO_DATE_FORMAT.test(value)) {
      return new Date(value);
    }
    return value;
  });
}

export function buildMessageStreamUrl(
  baseUrl: string,
  sessionId: string,
  streamPath = '/api/sessions/messages/stream'
): string {
  const params = new URLSearchParams({
    'agent-session-id': sessionId,
  });

  return `${joinApiUrl(baseUrl, streamPath)}?${params.toString()}`;
}

/** @deprecated Use buildMessageStreamUrl instead */
export const buildSessionEventsUrl = buildMessageStreamUrl;

export function joinApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function buildAuthHeaders(apiKey?: string, extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

export const defaultRetryTimes = 3;
