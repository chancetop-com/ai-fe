import { memo } from 'react';
import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SessionArtifact, TodoStatus } from '@connexup/ai-api';
import { Bot, Loader2, Paperclip, Shield, ShieldOff, Sparkles, User } from 'lucide-react';
import type { ChatMessage } from '../chat-state';
import { getMessageArtifacts } from '../artifact-utils';
import { getMessageText } from '../chat-state';
import { ArtifactCard } from './ArtifactCard';
import type { ArtifactSpec } from './artifactTypes';
import { CopyButton } from './CopyButton';
import { ErrorBlock } from './ErrorBlock';
import { PlanUpdateBlock } from './PlanUpdateBlock';
import { SandboxBlock } from './SandboxBlock';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolsBlock } from './ToolsBlock';
import { formatMessageTime, formatMessageTimeFull } from '../utils';

export interface ChatMessageRowProps {
  message: ChatMessage;
  isStreaming: boolean;
  isThinking: boolean;
  planTodos?: Array<{ content: string; status: TodoStatus }> | null;
  sessionArtifacts?: SessionArtifact[];
  agentMarkdownComponents?: ComponentProps<typeof ReactMarkdown>['components'];
  onOpenArtifact?: (spec: ArtifactSpec) => void;
  onApprove?: (callId: string, approved: boolean) => void;
}

function hasAnySegments(message: ChatMessage): boolean {
  return message.segments.length > 0;
}

function hasTextSegments(message: ChatMessage): boolean {
  return message.segments.some(
    (segment) => (segment.type === 'text' && segment.content.trim()) || segment.type === 'error'
  );
}

export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  isStreaming,
  isThinking,
  planTodos = null,
  sessionArtifacts = [],
  agentMarkdownComponents,
  onOpenArtifact,
  onApprove,
}: ChatMessageRowProps) {
  const isUser = message.role === 'user';
  const isAgent = message.role === 'assistant';
  const attachments = message.metadata?.attachments ?? [];
  const hasAttachments = attachments.length > 0;
  const messageText = getMessageText(message);
  const msgArtifacts = message.role === 'assistant' ? getMessageArtifacts(message, sessionArtifacts) : [];

  if (message.role === 'system' && message.systemKind === 'compression') {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs animate-pulse"
        style={{
          background: 'var(--color-bg-tertiary)',
          color: 'var(--color-text-muted)',
          border: '1px solid var(--color-border)',
        }}
      >
        <Sparkles size={14} />
        <span>
          Context compressed: {message.systemMetadata?.beforeCount} → {message.systemMetadata?.afterCount} messages
        </span>
      </div>
    );
  }

  if (message.role === 'system' && message.systemKind === 'error') {
    return (
      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={{
          borderColor: colorMix('var(--color-error)', 30),
          background: colorMix('var(--color-error)', 10),
          color: 'var(--color-error)',
        }}
      >
        <div className="font-medium">{message.systemContent}</div>
        {message.systemMetadata?.errorDetail ? (
          <div className="text-xs mt-1 opacity-80">{message.systemMetadata.errorDetail}</div>
        ) : null}
      </div>
    );
  }

  const thinkingSeg = message.segments.find((segment) => segment.type === 'thinking');
  const toolsSeg = message.segments.find((segment) => segment.type === 'tools');
  const sandboxSeg = message.segments.find((segment) => segment.type === 'sandbox');
  const textSeg = message.segments.find((segment) => segment.type === 'text');
  const errorSegs = message.segments.filter((segment) => segment.type === 'error');
  const hasRenderableText = Boolean(textSeg?.content.trim());
  const hasRenderableErrors = errorSegs.length > 0;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {isAgent ? (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          <Bot size={18} />
        </div>
      ) : null}

      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        {sandboxSeg ? (
          <div className="mb-3">
            <SandboxBlock
              sandboxType={sandboxSeg.sandboxType}
              sandboxId={sandboxSeg.sandboxId}
              message={sandboxSeg.message}
              durationMs={sandboxSeg.durationMs}
            />
          </div>
        ) : null}

        {thinkingSeg ? (
          <div className="mb-3">
            <ThinkingBlock thinking={thinkingSeg.content} isStreaming={isStreaming} />
          </div>
        ) : null}

        {toolsSeg && toolsSeg.tools.length > 0 ? (
          <div className="mb-3">
            <ToolsBlock tools={toolsSeg.tools} />
          </div>
        ) : null}

        {isAgent && planTodos && planTodos.length > 0 ? (
          <div className="mb-3">
            <PlanUpdateBlock todos={planTodos} />
          </div>
        ) : null}

        {(hasAttachments || hasRenderableText || hasRenderableErrors) && (
          <div className="mb-3">
            {hasAttachments ? (
              <div
                className={`flex gap-2 flex-wrap ${hasRenderableText ? 'mb-2' : ''}`}
                style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}
              >
                {attachments.map((attachment, index) =>
                  attachment.type === 'IMAGE' ? (
                    <a
                      key={index}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg overflow-hidden border"
                      style={{
                        borderColor: 'var(--color-border)',
                        maxWidth: '160px',
                      }}
                    >
                      <img
                        src={attachment.url}
                        alt={attachment.file_name || `attachment-${index}`}
                        className="w-full h-24 object-cover"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <a
                      key={index}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{
                        background: 'var(--color-bg-tertiary)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      <Paperclip size={12} />
                      <span className="max-w-[120px] truncate">{attachment.file_name || attachment.type}</span>
                    </a>
                  )
                )}
              </div>
            ) : null}

            {hasRenderableText && textSeg ? (
              <div
                className={`rounded-xl px-4 py-3 text-sm overflow-x-auto${hasRenderableErrors ? ' mb-2' : ''}`}
                style={{
                  background: isUser ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                  color: isUser ? 'white' : 'var(--color-text)',
                  border: isUser ? 'none' : '1px solid var(--color-border)',
                }}
              >
                {isUser ? (
                  <div className="whitespace-pre-wrap">{textSeg.content}</div>
                ) : (
                  <div className="ai-chat-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={agentMarkdownComponents}>
                      {textSeg.content}
                    </ReactMarkdown>
                  </div>
                )}
                {isStreaming && textSeg.content ? <span className="ai-chat-stream-cursor" /> : null}
              </div>
            ) : null}

            {hasRenderableErrors
              ? errorSegs.map((errorSeg, index) => (
                  <div key={`error-${index}`} className={index < errorSegs.length - 1 ? 'mb-2' : ''}>
                    <ErrorBlock
                      message={errorSeg.message}
                      detail={errorSeg.detail}
                      errorCode={errorSeg.errorCode}
                    />
                  </div>
                ))
              : null}
          </div>
        )}

        {msgArtifacts.length > 0 && onOpenArtifact ? (
          <div className="mt-2 flex flex-col items-start gap-1">
            {msgArtifacts.map((artifact) => (
              <ArtifactCard
                key={artifact.file_id}
                artifact={{
                  kind: 'file',
                  title: artifact.title || artifact.file_name,
                  fileId: artifact.file_id,
                  fileName: artifact.file_name,
                  contentType: artifact.content_type,
                  size: artifact.size,
                }}
                onOpen={onOpenArtifact}
              />
            ))}
          </div>
        ) : null}

        {message.approval ? (
          <div
            className="rounded-xl border px-4 py-3 mt-2"
            style={{
              borderColor: colorMix('var(--color-warning)', 40),
              background: 'var(--color-bg-secondary)',
            }}
          >
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--color-warning)' }}>
              Tool requires approval
            </div>
            <div className="text-xs font-mono mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="font-bold">{message.approval.tool}</span>
              {message.approval.arguments ? (
                <pre className="mt-1 whitespace-pre-wrap opacity-70" style={{ margin: 0 }}>
                  {message.approval.arguments.length > 200
                    ? `${message.approval.arguments.slice(0, 200)}...`
                    : message.approval.arguments}
                </pre>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onApprove?.(message.approval?.callId || '', true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                style={{
                  background: 'var(--color-success)',
                  color: 'white',
                  border: 'none',
                }}
              >
                <Shield size={14} /> Approve
              </button>
              <button
                type="button"
                onClick={() => onApprove?.(message.approval?.callId || '', false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                style={{
                  background: 'var(--color-error)',
                  color: 'white',
                  border: 'none',
                }}
              >
                <ShieldOff size={14} /> Deny
              </button>
            </div>
          </div>
        ) : null}

        {isStreaming && isAgent && !hasAnySegments(message) && !message.approval ? (
          <div className="flex items-center gap-2 py-2 px-1">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Thinking...
            </span>
          </div>
        ) : null}

        {(message.timestamp || hasTextSegments(message) || hasAttachments) && (
          <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : ''}`}>
            {hasTextSegments(message) ? <CopyButton text={messageText} /> : null}
            {message.timestamp ? (
              <span
                className="text-[11px] leading-none select-none"
                title={formatMessageTimeFull(message.timestamp)}
                style={{ color: 'var(--color-text-muted)' }}
              >
                {formatMessageTime(message.timestamp)}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {isUser ? (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <User size={18} />
        </div>
      ) : null}
    </div>
  );
});

function colorMix(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, var(--color-border))`;
}
