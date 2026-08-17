export const DEFAULT_STREAM_ERROR_MESSAGES: Record<string, string> = {
  QUOTA_EXCEEDED: 'Your daily quota has been exhausted. Please try again tomorrow.',
};

export function resolveStreamErrorMessage(errorCode: string | undefined, fallbackMessage: string): string {
  if (!errorCode) return fallbackMessage;

  return DEFAULT_STREAM_ERROR_MESSAGES[errorCode] ?? fallbackMessage;
}
