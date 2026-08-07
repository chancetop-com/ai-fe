import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent, RefObject } from 'react';
import type { BlobApi } from '@connexup/ai-api';
import { Loader2, Paperclip, Send, Square, X } from 'lucide-react';
import {
  formatAttachmentSizeLimit,
  getAttachmentSizeLimit,
  isValidAttachmentType,
  mapAttachmentType,
  resolveFileType,
  resolveUploadCategory,
  type ComposerAttachment,
} from '../attachment-utils';
import { message } from '../message';
import { formatApiError } from '../utils';

export type { ComposerAttachment };

export interface ChatComposerHandle {
  focus: () => void;
  reset: () => void;
  setDraft: (text: string) => void;
}

export interface ChatComposerProps {
  disabled?: boolean;
  isStreaming: boolean;
  placeholder?: string;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  blobApi: BlobApi;
  onSend: (text: string, attachments?: ComposerAttachment[]) => void | Promise<void>;
  onCancel: () => void;
}

interface PendingAttachment {
  id: string;
  name: string;
  url: string;
  contentType: string;
  category: string;
  container?: string;
  blobName?: string;
  uploading: boolean;
}

export const ChatComposer = memo(
  forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
    {
      disabled = false,
      isStreaming,
      placeholder = 'Send a message...',
      messagesContainerRef,
      blobApi,
      onSend,
      onCancel,
    },
    ref
  ) {
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resizeTextarea = useCallback(() => {
      const textarea = inputRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      const maxHeight = (messagesContainerRef.current?.clientHeight ?? 600) / 3;
      const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [messagesContainerRef]);

    const uploadFile = useCallback(
      async (file: File) => {
        const contentType = resolveFileType(file);
        if (!isValidAttachmentType(contentType)) {
          message.warning(`Unsupported file type: ${file.name} (${contentType || 'unknown'})`);
          return;
        }

        const sizeLimit = getAttachmentSizeLimit(contentType);
        if (file.size > sizeLimit) {
          message.warning(`File too large: ${file.name}. Maximum size is ${formatAttachmentSizeLimit(contentType)}.`);
          return;
        }

        const category = resolveUploadCategory(contentType);
        const id = crypto.randomUUID();
        setPendingAttachments((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            url: '',
            contentType,
            category,
            uploading: true,
          },
        ]);

        try {
          const credential = await blobApi.getUploadCredential(contentType, category);
          await blobApi.uploadFile(credential, file, contentType);
          setPendingAttachments((prev) =>
            prev.map((attachment) =>
              attachment.id === id
                ? {
                    ...attachment,
                    url: credential.blob_url,
                    contentType,
                    container: credential.container,
                    blobName: credential.blob_name,
                    uploading: false,
                  }
                : attachment
            )
          );
        } catch (error) {
          message.error(formatApiError(error, `Upload failed for ${file.name}`));
          setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
        }
      },
      [blobApi]
    );

    const handleFileSelect = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
      async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        for (const file of Array.from(files)) {
          await uploadFile(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      [uploadFile]
    );

    const handlePaste = useCallback(
      (event: ClipboardEvent<HTMLTextAreaElement>) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          if (!item) continue;
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              const extension = file.type.split('/')[1] || 'png';
              imageFiles.push(new File([file], `clipboard-image-${Date.now()}.${extension}`, { type: file.type }));
            }
          }
        }

        if (imageFiles.length > 0) {
          event.preventDefault();
          for (const file of imageFiles) {
            void uploadFile(file);
          }
        }
      },
      [uploadFile]
    );

    const removeAttachment = useCallback((id: string) => {
      setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
    }, []);

    const submitMessage = useCallback(
      async (rawText: string) => {
        const text = rawText.trim();
        const readyAttachments = pendingAttachments.filter((attachment) => !attachment.uploading);
        const hasAttachments = readyAttachments.length > 0;
        if ((!text && !hasAttachments) || disabled || isStreaming || sending) {
          return;
        }
        if (pendingAttachments.some((attachment) => attachment.uploading)) {
          message.warning('Please wait for uploads to finish');
          return;
        }

        const mappedAttachments: ComposerAttachment[] = readyAttachments.map((attachment) => ({
          url: attachment.url,
          type: mapAttachmentType(attachment.contentType),
          file_name: attachment.name,
          content_type: attachment.contentType,
          category: attachment.category,
          container: attachment.container,
          blob_name: attachment.blobName,
        }));

        setInput('');
        setPendingAttachments([]);
        setSending(true);
        resizeTextarea();

        try {
          await onSend(text, mappedAttachments.length ? mappedAttachments : undefined);
        } finally {
          setSending(false);
          resizeTextarea();
        }
      },
      [disabled, isStreaming, onSend, pendingAttachments, resizeTextarea, sending]
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        reset: () => {
          setInput('');
          setPendingAttachments([]);
          resizeTextarea();
        },
        setDraft: (text: string) => {
          setInput(text);
          requestAnimationFrame(() => inputRef.current?.focus());
        },
      }),
      [resizeTextarea]
    );

    useEffect(() => {
      resizeTextarea();
    }, [input, resizeTextarea]);

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey) return;
        event.preventDefault();
        if (event.nativeEvent.isComposing) return;
        void submitMessage(event.currentTarget.value);
      },
      [submitMessage]
    );

    const hasReadyAttachments = pendingAttachments.some((attachment) => !attachment.uploading);
    const canSend =
      (input.trim().length > 0 || hasReadyAttachments) &&
      !disabled &&
      !sending &&
      !pendingAttachments.some((attachment) => attachment.uploading);

    return (
      <div className="ai-chat-composer">
        <div className="max-w-4xl mx-auto">
          {pendingAttachments.length > 0 ? (
            <div className="flex gap-2 flex-wrap mb-2">
              {pendingAttachments.map((attachment) => (
                <span
                  key={attachment.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{
                    background: attachment.uploading ? 'var(--color-bg-tertiary)' : 'var(--color-primary)' + '12',
                    border: attachment.uploading
                      ? '1px dashed var(--color-border)'
                      : '1px solid var(--color-primary)' + '20',
                    color: attachment.uploading ? 'var(--color-text-muted)' : 'var(--color-primary)',
                  }}
                >
                  {attachment.uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                  <span className="max-w-[120px] truncate">{attachment.name}</span>
                  {!attachment.uploading ? (
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="ml-0.5 cursor-pointer"
                      style={{
                        color: 'var(--color-text-muted)',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex gap-2 items-end">
            <button
              type="button"
              onClick={handleFileSelect}
              disabled={disabled || isStreaming || sending}
              className="ai-chat-btn-icon shrink-0"
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />

            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              rows={1}
              className="ai-chat-textarea flex-1"
              disabled={disabled || isStreaming || sending}
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={onCancel}
                className="ai-chat-btn-icon ai-chat-btn-icon--danger shrink-0"
                title="Cancel"
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submitMessage(input)}
                disabled={!canSend}
                className="ai-chat-btn-icon ai-chat-btn-icon--primary shrink-0"
                title="Send"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  })
);
