import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ChatSessionSummary } from '@connexup/ai-api';
import { CheckSquare, Loader2, MessageSquare, MoreHorizontal, Pencil, Plus, Square, Trash2, X } from 'lucide-react';
import { DRAFT_CHAT_SESSION_ID } from '../useAiChat';
import { ConfirmModal } from './ConfirmModal';
import { message } from '../message';
import { formatApiError, formatMessageTimeFull } from '../utils';

export interface ChatSessionsSidebarProps {
  currentSessionId: string | null;
  draftSession?: ChatSessionSummary | null;
  sessions: ChatSessionSummary[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSessionsChange: Dispatch<SetStateAction<ChatSessionSummary[]>>;
  onTotalChange: Dispatch<SetStateAction<number>>;
  renameChatSession: (sessionId: string, title: string) => Promise<unknown>;
  deleteChatSession: (sessionId: string) => Promise<unknown>;
  batchDeleteChatSessions: (sessionIds: string[]) => Promise<unknown>;
  onOpen: (session: ChatSessionSummary) => void;
  onNewChat: () => void;
  onDraftResolved?: () => void;
  onDeleted?: (deletedSessionId: string, remainingSessions: ChatSessionSummary[]) => void;
}

type DeleteConfirmState =
  | { kind: 'single'; sessionId: string }
  | { kind: 'batch'; ids: string[] }
  | null;

function formatTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ChatSessionsSidebar({
  currentSessionId,
  draftSession,
  sessions,
  total,
  loading,
  loadingMore,
  onLoadMore,
  onSessionsChange,
  onTotalChange,
  renameChatSession,
  deleteChatSession,
  batchDeleteChatSessions,
  onOpen,
  onNewChat,
  onDraftResolved,
  onDeleted,
}: ChatSessionsSidebarProps) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!draftSession) return;
    if (sessions.some((session) => session.id === draftSession.id)) {
      onDraftResolved?.();
    }
  }, [draftSession, onDraftResolved, sessions]);

  const visibleSessions = draftSession
    ? [draftSession, ...sessions.filter((session) => session.id !== draftSession.id)]
    : sessions;

  useEffect(() => {
    if (!menuId) return;
    const onDocClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuId(null);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuId]);

  const requestDelete = (id: string) => {
    setMenuId(null);
    setDeleteConfirm({ kind: 'single', sessionId: id });
  };

  const requestBatchDelete = () => {
    if (selectedIds.size === 0 || deleting) return;
    setDeleteConfirm({ kind: 'batch', ids: Array.from(selectedIds) });
  };

  const closeDeleteConfirm = () => {
    if (deleting) return;
    setDeleteConfirm(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || deleting) return;

    setDeleting(true);
    try {
      if (deleteConfirm.kind === 'single') {
        const id = deleteConfirm.sessionId;
        await deleteChatSession(id);
        onSessionsChange((prev) => {
          const remaining = prev.filter((session) => session.id !== id);
          onDeleted?.(id, remaining);
          return remaining;
        });
        onTotalChange((prev) => Math.max(0, prev - 1));
      } else {
        const ids = deleteConfirm.ids;
        const idsSet = new Set(ids);
        await batchDeleteChatSessions(ids);
        onSessionsChange((prev) => {
          const remaining = prev.filter((session) => !idsSet.has(session.id));
          if (
            currentSessionId &&
            currentSessionId !== DRAFT_CHAT_SESSION_ID &&
            idsSet.has(currentSessionId)
          ) {
            onDeleted?.(currentSessionId, remaining);
          }
          return remaining;
        });
        onTotalChange((prev) => Math.max(0, prev - ids.length));
        exitSelectMode();
      }
      setDeleteConfirm(null);
    } catch (error) {
      console.warn('failed to delete chat session(s)', error);
      message.error(
        formatApiError(
          error,
          deleteConfirm.kind === 'single' ? 'Failed to delete conversation' : 'Failed to delete conversations'
        )
      );
    } finally {
      setDeleting(false);
    }
  };

  const deleteConfirmTitle =
    deleteConfirm?.kind === 'batch'
      ? `Delete ${deleteConfirm.ids.length} conversation${deleteConfirm.ids.length > 1 ? 's' : ''}?`
      : 'Delete conversation?';

  const deleteConfirmContent =
    deleteConfirm?.kind === 'batch'
      ? 'The selected conversations will be permanently removed. This action cannot be undone.'
      : (() => {
          if (!deleteConfirm || deleteConfirm.kind !== 'single') return '';
          const title = sessions.find((session) => session.id === deleteConfirm.sessionId)?.title || '(untitled)';
          return `"${title}" will be permanently removed. This action cannot be undone.`;
        })();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const openRename = (session: ChatSessionSummary) => {
    setMenuId(null);
    setRenameId(session.id);
    setRenameValue(session.title || '');
    setRenameError('');
  };

  const closeRename = () => {
    if (saving) return;
    setRenameId(null);
    setRenameValue('');
    setRenameError('');
  };

  const submitRename = async () => {
    const id = renameId;
    const title = renameValue.trim().replace(/\s+/g, ' ');
    if (!id || !title) return;

    setSaving(true);
    setRenameError('');
    try {
      await renameChatSession(id, title);
      onSessionsChange((prev) => prev.map((session) => (session.id === id ? { ...session, title } : session)));
      setRenameId(null);
      setRenameValue('');
    } catch (error) {
      console.warn('failed to rename chat session', error);
      setRenameError('Failed to rename. Please try again.');
      message.error(formatApiError(error, 'Failed to rename conversation'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="ai-chat-sidebar flex flex-col h-full shrink-0"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-bg-secondary)',
      }}
    >
      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {selecting ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exitSelectMode}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs cursor-pointer flex-1"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-secondary)',
                border: 'none',
              }}
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="button"
              onClick={() => requestBatchDelete()}
              disabled={selectedIds.size === 0 || deleting}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs cursor-pointer disabled:opacity-50 flex-1"
              style={{ background: 'var(--color-error)', color: 'white', border: 'none' }}
            >
              {deleting ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 size={14} /> Delete ({selectedIds.size})
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onNewChat}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'white', border: 'none' }}
            >
              <Plus size={14} /> New Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setSelecting(true);
                setSelectedIds(new Set());
                setMenuId(null);
              }}
              disabled={sessions.length === 0}
              className="flex items-center justify-center p-2 rounded-lg cursor-pointer disabled:opacity-30"
              style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none' }}
              title="Select conversations"
            >
              <CheckSquare size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading && visibleSessions.length === 0 ? (
          <div className="flex items-center justify-center py-6" style={{ color: 'var(--color-text-secondary)' }}>
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : null}
        {!loading && visibleSessions.length === 0 ? (
          <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
            No conversations yet
          </div>
        ) : null}

        {visibleSessions.map((session, index) => {
          const isDraft = draftSession != null && index === 0 && session.id === draftSession.id;
          const active = session.id === currentSessionId;
          const selected = selectedIds.has(session.id);

          return (
            <div
              key={session.id}
              onClick={() => {
                if (isDraft) return;
                if (selecting) {
                  toggleSelect(session.id);
                  return;
                }
                onOpen(session);
              }}
              className="group relative w-full text-left px-3 py-2 flex items-start gap-2 cursor-pointer"
              style={{
                borderLeft: active && !selecting ? '2px solid var(--color-primary)' : '2px solid transparent',
                background:
                  selecting && selected
                    ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))'
                    : active && !selecting
                      ? 'var(--color-bg-tertiary)'
                      : 'transparent',
                color: 'var(--color-text)',
              }}
            >
              {isDraft ? (
                <MessageSquare size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
              ) : selecting ? (
                selected ? (
                  <CheckSquare size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                ) : (
                  <Square size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                )
              ) : (
                <MessageSquare size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" title={session.title || session.id}>
                  {session.title || '(untitled)'}
                </div>
                <div
                  className="text-[10px] mt-0.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title={formatMessageTimeFull(session.last_message_at || session.created_at)}
                >
                  {formatTime(session.last_message_at || session.created_at)}
                  {session.message_count ? ` · ${session.message_count} msg` : ''}
                </div>
              </div>
              {!selecting && !isDraft ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuId(menuId === session.id ? null : session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 mt-0.5 p-1 rounded cursor-pointer"
                  style={{
                    color: 'var(--color-text-secondary)',
                    background: 'none',
                    border: 'none',
                  }}
                  title="More actions"
                >
                  <MoreHorizontal size={14} />
                </button>
              ) : null}
              {menuId === session.id ? (
                <div
                  ref={menuRef}
                  onClick={(event) => event.stopPropagation()}
                  className="absolute right-2 top-8 z-10 py-1 rounded-md border shadow-md text-sm"
                  style={{
                    background: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openRename(session)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                    style={{
                      color: 'var(--color-text)',
                      background: 'none',
                      border: 'none',
                    }}
                  >
                    <Pencil size={13} /> Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDelete(session.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                    style={{ color: 'var(--color-error)', background: 'none', border: 'none' }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {sessions.length < total ? (
          <button
            type="button"
            onClick={() => void onLoadMore()}
            disabled={loadingMore}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs cursor-pointer disabled:opacity-50"
            style={{
              color: 'var(--color-text-secondary)',
              background: 'none',
              border: 'none',
            }}
          >
            {loadingMore ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Loading…
              </>
            ) : (
              'More'
            )}
          </button>
        ) : null}
      </div>

      {renameId ? (
        <div className="ai-chat-modal-backdrop" onClick={closeRename} role="presentation">
          <div
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Rename conversation"
            className="w-80 p-4 rounded-lg border shadow-lg"
            style={{
              background: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Rename conversation
            </div>
            <input
              autoFocus
              value={renameValue}
              maxLength={100}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitRename();
                if (event.key === 'Escape') closeRename();
              }}
              className="w-full px-2 py-1.5 rounded border text-sm outline-none"
              style={{
                background: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
            {renameError ? (
              <div className="text-xs mt-1" style={{ color: 'var(--color-error)' }}>
                {renameError}
              </div>
            ) : null}
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={closeRename}
                disabled={saving}
                className="px-3 py-1.5 rounded text-sm cursor-pointer"
                style={{
                  color: 'var(--color-text-secondary)',
                  background: 'none',
                  border: 'none',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitRename()}
                disabled={saving || !renameValue.trim()}
                className="px-3 py-1.5 rounded text-sm cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: 'white', border: 'none' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={deleteConfirm != null}
        title={deleteConfirmTitle}
        content={deleteConfirmContent}
        okText="Delete"
        cancelText="Cancel"
        danger
        loading={deleting}
        onOk={confirmDelete}
        onCancel={closeDeleteConfirm}
      />
    </div>
  );
}
