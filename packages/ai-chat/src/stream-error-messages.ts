export const DEFAULT_STREAM_ERROR_MESSAGES: Record<string, string> = {
  QUOTA_EXCEEDED: 'Your daily quota has been exhausted. Please try again tomorrow.',
  connection_disconnected: '连接已断开，请刷新页面继续。',
};

export function resolveStreamErrorMessage(errorCode: string | undefined, fallbackMessage: string): string {
  if (!errorCode) return fallbackMessage;

  return DEFAULT_STREAM_ERROR_MESSAGES[errorCode] ?? fallbackMessage;
}
