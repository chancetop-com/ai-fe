import { APIException, NetworkConnectionException } from './exception';
import type { ErrorResponse } from './session-api-types';
import { safeParse } from './utils';

export interface ApiRequestOptions {
  fetch: typeof fetch;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  successStatuses?: number[];
}

export async function parseErrorResponse(response: Response): Promise<ErrorResponse> {
  try {
    const text = await response.text();
    const parsed = safeParse<ErrorResponse>(text);
    if (parsed?.message) {
      return parsed;
    }
    return {
      error: String(response.status),
      message: text || response.statusText || 'Request failed',
    };
  } catch {
    return {
      error: String(response.status),
      message: response.statusText || 'Request failed',
    };
  }
}

export function createAPIExceptionFromResponse(
  response: Response,
  url: string,
  errorData: ErrorResponse,
  responseBody?: unknown
): APIException {
  return new APIException(
    errorData.message || response.statusText || 'Request failed',
    response.status,
    url,
    responseBody ?? errorData,
    null,
    errorData.error || String(response.status)
  );
}

export function asAPIException(error: unknown): APIException | null {
  if (error instanceof APIException) {
    return error;
  }

  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as {
    name?: string;
    message?: string;
    statusCode?: unknown;
    requestURL?: string;
    responseData?: unknown;
    errorId?: string | null;
    errorCode?: string | null;
  };

  if (candidate.name !== 'APIException' || typeof candidate.statusCode !== 'number') {
    return null;
  }

  return new APIException(
    candidate.message || 'Request failed',
    candidate.statusCode,
    candidate.requestURL || '',
    candidate.responseData ?? null,
    candidate.errorId ?? null,
    candidate.errorCode ?? null
  );
}

export function normalizeRequestError(error: unknown, url: string, fallbackMessage = 'Request failed'): Error {
  const apiError = asAPIException(error);
  if (apiError) {
    return apiError;
  }

  if (error instanceof NetworkConnectionException || error instanceof Error) {
    return error;
  }

  return new NetworkConnectionException(fallbackMessage, url, String(error));
}

export async function assertOkResponse(response: Response, url: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const text = await response.text();
  const parsed = safeParse<ErrorResponse>(text);
  const errorData: ErrorResponse = parsed?.message
    ? parsed
    : {
        error: String(response.status),
        message: text || response.statusText || 'Request failed',
      };
  throw createAPIExceptionFromResponse(response, url, errorData, text || errorData);
}

export async function apiRequest<T>(options: ApiRequestOptions): Promise<T> {
  const { fetch: fetchFn, url, method, headers, body, successStatuses = [200, 201] } = options;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method,
      headers,
      body,
    });
  } catch (error) {
    throw new NetworkConnectionException(
      `Failed to request: ${url}`,
      url,
      error instanceof Error ? error.message : 'UNKNOWN'
    );
  }

  if (successStatuses.includes(response.status)) {
    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    const data = safeParse<T>(text);
    if (data === null) {
      throw new APIException('Invalid JSON response', response.status, url, text, null, 'invalid_json');
    }
    return data;
  }

  const errorData = await parseErrorResponse(response);
  throw createAPIExceptionFromResponse(response, url, errorData);
}
