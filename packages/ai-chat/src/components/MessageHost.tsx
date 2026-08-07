import { useEffect, useState, type CSSProperties } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { subscribeMessages, type MessageItem, type MessageType } from '../message';

function MessageIcon({ type }: { type: MessageType }) {
  const size = 16;
  switch (type) {
    case 'success':
      return <CheckCircle2 size={size} />;
    case 'warning':
      return <TriangleAlert size={size} />;
    case 'error':
      return <AlertCircle size={size} />;
    default:
      return <Info size={size} />;
  }
}

function messageStyle(type: MessageType): CSSProperties {
  switch (type) {
    case 'success':
      return {
        background: 'color-mix(in srgb, var(--color-success) 12%, var(--color-bg))',
        borderColor: 'color-mix(in srgb, var(--color-success) 35%, var(--color-border))',
        color: 'var(--color-success)',
      };
    case 'warning':
      return {
        background: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-bg))',
        borderColor: 'color-mix(in srgb, var(--color-warning) 35%, var(--color-border))',
        color: 'var(--color-warning)',
      };
    case 'error':
      return {
        background: 'color-mix(in srgb, var(--color-error) 12%, var(--color-bg))',
        borderColor: 'color-mix(in srgb, var(--color-error) 35%, var(--color-border))',
        color: 'var(--color-error)',
      };
    default:
      return {
        background: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text)',
      };
  }
}

export function MessageHost() {
  const [items, setItems] = useState<MessageItem[]>([]);

  useEffect(() => subscribeMessages(setItems), []);

  if (items.length === 0) return null;

  return (
    <div className="ai-chat-message-host" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="ai-chat-message-item" style={messageStyle(item.type)} role="alert">
          <MessageIcon type={item.type} />
          <span>{item.content}</span>
        </div>
      ))}
    </div>
  );
}
