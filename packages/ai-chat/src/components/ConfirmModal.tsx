import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  content: string;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onOk: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  content,
  okText = 'OK',
  cancelText = 'Cancel',
  danger = false,
  loading = false,
  onOk,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div className="ai-chat-modal-backdrop" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ai-chat-confirm-title"
        aria-describedby="ai-chat-confirm-content"
        className="w-[416px] max-w-[calc(100vw-2rem)] rounded-lg border shadow-lg overflow-hidden"
        style={{
          background: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex gap-3 p-4">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: danger
                ? 'color-mix(in srgb, var(--color-error) 12%, var(--color-bg))'
                : 'color-mix(in srgb, var(--color-warning) 12%, var(--color-bg))',
              color: danger ? 'var(--color-error)' : 'var(--color-warning)',
            }}
          >
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div id="ai-chat-confirm-title" className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {title}
            </div>
            <div
              id="ai-chat-confirm-content"
              className="text-sm mt-2 leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {content}
            </div>
          </div>
        </div>
        <div
          className="flex justify-end gap-2 px-4 py-3 border-t"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-bg-secondary)',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 rounded text-sm cursor-pointer disabled:opacity-50"
            style={{
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => void onOk()}
            disabled={loading}
            className="px-3 py-1.5 rounded text-sm cursor-pointer disabled:opacity-50"
            style={{
              background: danger ? 'var(--color-error)' : 'var(--color-primary)',
              color: 'white',
              border: 'none',
            }}
          >
            {loading ? 'Deleting…' : okText}
          </button>
        </div>
      </div>
    </div>
  );
}
