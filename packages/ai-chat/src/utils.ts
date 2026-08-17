import { APIException } from '@connexup/ai-api';
import { DEFAULT_STREAM_ERROR_MESSAGES } from './stream-error-messages';

export function formatMessageTime(timestamp?: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `${hh}:${mm}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${hh}:${mm}`;
  }
  const M = pad(date.getMonth() + 1);
  const D = pad(date.getDate());
  if (date.getFullYear() === now.getFullYear()) return `${M}-${D} ${hh}:${mm}`;
  return `${date.getFullYear()}-${M}-${D} ${hh}:${mm}`;
}

export function formatMessageTimeFull(timestamp?: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function normalizeArgs(argsJson: string | undefined): Record<string, unknown> | null {
  if (!argsJson || argsJson === '{}') return null;
  try {
    const args = JSON.parse(argsJson);
    if (
      args &&
      typeof args === 'object' &&
      !Array.isArray(args) &&
      Object.keys(args).length === 1 &&
      'raw' in args &&
      typeof args.raw === 'string'
    ) {
      try {
        return JSON.parse(args.raw);
      } catch {
        return args;
      }
    }
    return args;
  } catch {
    return null;
  }
}

export function getArgsPreview(argsJson: string | undefined): string | null {
  const args = normalizeArgs(argsJson);
  if (!args) return null;
  if (typeof args.description === 'string' && args.description) {
    return args.description;
  }
  const entries = Object.entries(args).filter(([k]) => k !== 'raw');
  if (entries.length === 0) return null;
  const preview = entries
    .slice(0, 2)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v);
      const shortVal = val.length > 60 ? `${val.slice(0, 60)}...` : val;
      return `${k}: ${shortVal}`;
    })
    .join(', ');
  if (entries.length > 2) return `${preview}, ...`;
  return preview;
}

export function formatJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function resolveApiErrorMessage(error: unknown): string | null {
  if (error instanceof APIException) {
    const mappedMessage = error.errorCode ? DEFAULT_STREAM_ERROR_MESSAGES[error.errorCode ?? ''] : undefined;
    if (mappedMessage) return mappedMessage;

    if (error.statusCode === 401) return 'Unauthorized';
    if (error.statusCode === 429) return DEFAULT_STREAM_ERROR_MESSAGES.QUOTA_EXCEEDED!;
    if (error.statusCode === 500) return 'Internal server error';
    if (error.message) return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error === 'string') return error;
  return null;
}

export function formatApiError(error: unknown, fallback = 'Request failed'): string {
  return resolveApiErrorMessage(error) ?? fallback;
}
