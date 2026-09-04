import type { ChatMessage } from './chat-state';
import { createAgentPlaceholder } from './chat-state';

/**
 * Reset the trailing assistant bubble so replayed turn events rebuild it from scratch.
 */
export function clearActiveAgentBubble(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant' || last.segments.length === 0) return messages;
  const updated = [...messages];
  updated[updated.length - 1] = { ...last, segments: [] };
  return updated;
}

/** Keep live in-flight content when authoritative history has not persisted the reply yet. */
export function mergeHistoryWithLive(hydrated: ChatMessage[], live: ChatMessage[]): ChatMessage[] {
  const lastHydrated = hydrated[hydrated.length - 1];
  if (lastHydrated?.role !== 'user') return hydrated;
  const lastLive = live[live.length - 1];
  if (lastLive?.role === 'assistant' && lastLive.segments.length > 0) {
    return [...hydrated, lastLive];
  }
  return [...hydrated, createAgentPlaceholder()];
}

/** Give a resumed turn a bubble to stream into when the restored list ends with the user message. */
export function ensureTrailingAgentBubble(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role === 'assistant') return messages;
  return [...messages, createAgentPlaceholder()];
}

export type RestoredTurnAction = 'resume' | 'resync' | 'none';

export function resolveRestoredTurn(
  status: string | null | undefined,
  messages: ChatMessage[],
  locallyCancelled = false
): RestoredTurnAction {
  if (!status) return 'none';
  if (status === 'running' && !locallyCancelled) return 'resume';
  const last = messages[messages.length - 1];
  const awaitingReply =
    last?.role === 'user' || (last?.role === 'assistant' && last.segments.length === 0);
  return awaitingReply ? 'resync' : 'none';
}
