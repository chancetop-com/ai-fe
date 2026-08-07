import { memo, useMemo, useRef, useEffect, useCallback, useState } from 'react';
import type { ComponentProps, RefObject } from 'react';
import type { SessionArtifact } from '@connexup/ai-api';
import { Bot, ChevronDown } from 'lucide-react';
import type { ChatMessage } from '../chat-state';
import { ArtifactCard } from './ArtifactCard';
import { ChatMessageRow } from './ChatMessageRow';
import type { ArtifactSpec } from './artifactTypes';

export const INITIAL_VISIBLE_MESSAGES = 40;
export const MESSAGE_RENDER_BATCH = 40;

export interface ChatMessagesPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  isThinking: boolean;
  planTodos?: Array<{
    content: string;
    status: import('@connexup/ai-api').TodoStatus;
  }> | null;
  title?: string;
  sessionArtifacts?: SessionArtifact[];
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  onApprove?: (callId: string, approved: boolean) => void;
  onOpenArtifact?: (spec: ArtifactSpec) => void;
}

export const ChatMessagesPanel = memo(function ChatMessagesPanel({
  messages,
  isStreaming,
  isThinking,
  planTodos = null,
  title = 'AI Assistant',
  sessionArtifacts = [],
  messagesContainerRef,
  bottomRef,
  onApprove,
  onOpenArtifact,
}: ChatMessagesPanelProps) {
  const [visibleMessageLimit, setVisibleMessageLimit] = useState(INITIAL_VISIBLE_MESSAGES);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const stickToBottomRef = useRef(true);

  const renderableMessages = useMemo(
    () => messages.filter((message) => shouldRenderMessage(message, isStreaming)),
    [messages, isStreaming]
  );

  const hiddenMessageCount = Math.max(0, renderableMessages.length - visibleMessageLimit);
  const visibleMessages = hiddenMessageCount > 0 ? renderableMessages.slice(hiddenMessageCount) : renderableMessages;

  const agentMarkdownComponents = useMemo<
    NonNullable<ComponentProps<typeof import('react-markdown').default>['components']>
  >(
    () => ({
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        if (match?.[1] && onOpenArtifact) {
          const lang = match[1].toLowerCase();
          const codeText = String(children ?? '').replace(/\n$/, '');
          if (lang === 'html' || lang === 'svg') {
            return (
              <ArtifactCard
                artifact={{
                  kind: lang,
                  language: lang,
                  title: lang === 'html' ? 'HTML page' : 'SVG image',
                  content: codeText,
                }}
                onOpen={onOpenArtifact}
              />
            );
          }
          return (
            <ArtifactCard
              artifact={{
                kind: 'code',
                language: lang,
                title: `${lang} snippet`,
                content: codeText,
              }}
              onOpen={onOpenArtifact}
            />
          );
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
    }),
    [onOpenArtifact]
  );

  const lastStreamingKey = useMemo(() => {
    if (!isStreaming) return null;
    const last = messages[messages.length - 1];
    return last?.role === 'assistant' ? (last.key ?? null) : null;
  }, [isStreaming, messages]);

  const handleMessagesScroll = useCallback(() => {
    const element = messagesContainerRef.current;
    if (!element) return;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    stickToBottomRef.current = atBottom;
    setShowJumpToBottom(!atBottom);
  }, [messagesContainerRef]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      bottomRef.current?.scrollIntoView({ behavior });
      stickToBottomRef.current = true;
      setShowJumpToBottom(false);
    },
    [bottomRef]
  );

  useEffect(() => {
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, bottomRef]);

  return (
    <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="ai-chat-messages">
      {messages.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center"
          style={{ height: '100%', color: 'var(--color-text-secondary)' }}
        >
          <Bot size={48} strokeWidth={1.5} />
          <div className="text-lg font-medium">{title}</div>
          <div className="text-sm">Send a message to start</div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {hiddenMessageCount > 0 ? (
            <button
              type="button"
              onClick={() => setVisibleMessageLimit((limit) => limit + MESSAGE_RENDER_BATCH)}
              className="self-center rounded-lg border px-3 py-1.5 text-xs cursor-pointer"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Show earlier messages ({hiddenMessageCount})
            </button>
          ) : null}

          {visibleMessages.map((message) => (
            <ChatMessageRow
              key={message.key}
              message={message}
              isStreaming={isStreaming && message.key === lastStreamingKey}
              isThinking={isThinking}
              planTodos={isStreaming && message.key === lastStreamingKey ? planTodos : null}
              sessionArtifacts={sessionArtifacts}
              agentMarkdownComponents={message.role === 'assistant' ? agentMarkdownComponents : undefined}
              onOpenArtifact={onOpenArtifact}
              onApprove={onApprove}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {showJumpToBottom ? (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="ai-chat-jump-btn"
          title="Jump to latest"
        >
          <ChevronDown size={18} />
        </button>
      ) : null}
    </div>
  );
});

function shouldRenderMessage(message: ChatMessage, isStreaming: boolean): boolean {
  if (message.role === 'system') return true;
  if (message.role === 'user') {
    return message.segments.length > 0 || Boolean(message.metadata?.attachments?.length);
  }
  if (message.segments.length > 0) return true;
  if (message.approval) return true;
  if (isStreaming && message.streaming) return true;
  return false;
}
