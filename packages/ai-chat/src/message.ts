export type MessageType = 'info' | 'success' | 'error' | 'warning';

export interface MessageItem {
  id: number;
  type: MessageType;
  content: string;
}

type MessageListener = (messages: MessageItem[]) => void;

const DEFAULT_DURATION = 3000;

let messageId = 0;
let messages: MessageItem[] = [];
const listeners = new Set<MessageListener>();

function emit() {
  const snapshot = [...messages];
  listeners.forEach((listener) => listener(snapshot));
}

function open(type: MessageType, content: string, duration = DEFAULT_DURATION) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const id = ++messageId;
  messages = [...messages, { id, type, content: trimmed }];
  emit();

  window.setTimeout(() => {
    messages = messages.filter((item) => item.id !== id);
    emit();
  }, duration);
}

export const message = {
  info(content: string, duration?: number) {
    open('info', content, duration);
  },
  success(content: string, duration?: number) {
    open('success', content, duration);
  },
  warning(content: string, duration?: number) {
    open('warning', content, duration);
  },
  error(content: string, duration?: number) {
    open('error', content, duration);
  },
};

export function subscribeMessages(listener: MessageListener) {
  listeners.add(listener);
  listener([...messages]);
  return () => {
    listeners.delete(listener);
  };
}
