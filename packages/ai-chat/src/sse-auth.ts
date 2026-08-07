import type { SseEvent } from '@connexup/ai-api';

// const SSE_UNAUTHORIZED_MESSAGE = 'invalid api key';

function parseUnauthorizedPayload(value: string | undefined): { errorCode?: string; message?: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { errorCode?: unknown; message?: unknown };
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      errorCode: typeof parsed.errorCode === 'string' ? parsed.errorCode : undefined,
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
    };
  } catch {
    return null;
  }
}

function isUnauthorizedPayload(payload: { errorCode?: string; message?: string } | null): boolean {
  return payload?.errorCode === 'UNAUTHORIZED';
}

export function isSseUnauthorizedError(event: SseEvent): boolean {
  if (event.type !== 'error') return false;

  if (isUnauthorizedPayload({ errorCode: event.errorCode, message: event.message })) {
    return true;
  }

  return isUnauthorizedPayload(parseUnauthorizedPayload(event.detail));
}
