import type { ChatMessage } from './chat-state';
import { createAgentPlaceholder } from './chat-state';

/** Replace the trailing assistant bubble with a fresh streaming placeholder (replay recovery). */
export function replaceTrailingAgentBubble(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant') return messages;
  const updated = [...messages];
  updated[updated.length - 1] = createAgentPlaceholder();
  return updated;
}

/** Give a resumed turn a bubble to stream into when the restored list ends with the user message. */
export function ensureTrailingAgentBubble(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role === 'assistant') return messages;
  return [...messages, createAgentPlaceholder()];
}

export type RestoredTurnAction = 'resume' | 'none';

export function resolveRestoredTurn(
  status: string | null | undefined,
  locallyCancelled = false
): RestoredTurnAction {
  if (status === 'running' && !locallyCancelled) return 'resume';
  return 'none';
}
