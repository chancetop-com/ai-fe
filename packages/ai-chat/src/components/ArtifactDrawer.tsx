import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FileApi } from '@connexup/ai-api';
import {
  Check,
  Code as CodeIcon,
  Copy,
  Download,
  FileCode,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Share2,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ArtifactSpec } from './artifactTypes';

const WIDTH_STORAGE_KEY = 'artifact_drawer_width';
const MIN_DRAWER_WIDTH = 320;
const DEFAULT_DRAWER_WIDTH = 520;
const RESERVED_CHAT_WIDTH = 400;
const TEXT_EXT_RE =
  /\.(html?|css|js|jsx|ts|tsx|mjs|json|md|markdown|txt|xml|svg|py|java|kt|go|rb|rs|sh|bash|yaml|yml|toml|csv|tsv|sql|conf|ini|log)$/i;

type ViewMode = 'preview' | 'source';
type ShareStatus = 'idle' | 'loading' | 'copied' | 'error';

export interface ArtifactDrawerProps {
  artifact: ArtifactSpec;
  fileApi: FileApi;
  onClose: () => void;
  hideShare?: boolean;
}

function iconFor(spec: ArtifactSpec) {
  if (spec.kind === 'html') return <Globe size={16} style={{ color: 'var(--color-primary)' }} />;
  if (spec.kind === 'svg') return <ImageIcon size={16} style={{ color: 'var(--color-primary)' }} />;
  if (spec.kind === 'markdown') return <FileText size={16} style={{ color: 'var(--color-primary)' }} />;
  if (spec.kind === 'code') return <CodeIcon size={16} style={{ color: 'var(--color-primary)' }} />;
  return <FileCode size={16} style={{ color: 'var(--color-primary)' }} />;
}

function isJsonCodeArtifact(spec: ArtifactSpec): boolean {
  return spec.kind === 'code' && spec.language?.toLowerCase() === 'json';
}

function isJsonFileArtifact(spec: ArtifactSpec): boolean {
  if (spec.kind !== 'file') return false;
  const contentType = spec.contentType?.toLowerCase() ?? '';
  if (contentType.includes('json')) return true;
  return Boolean(spec.fileName && /\.json$/i.test(spec.fileName));
}

function isTextFile(spec: ArtifactSpec): boolean {
  const contentType = spec.contentType?.toLowerCase();
  if (contentType) {
    if (contentType.startsWith('text/')) return true;
    if (
      contentType.includes('json') ||
      contentType.includes('xml') ||
      contentType.includes('javascript') ||
      contentType.includes('yaml')
    ) {
      return true;
    }
  }
  if (spec.fileName && TEXT_EXT_RE.test(spec.fileName)) return true;
  return false;
}

function supportsPreview(spec: ArtifactSpec): boolean {
  if (spec.kind === 'html' || spec.kind === 'svg' || spec.kind === 'markdown') {
    return true;
  }
  if (isJsonCodeArtifact(spec)) return true;
  if (spec.kind === 'file') return true;
  return false;
}

function supportsSource(spec: ArtifactSpec): boolean {
  if (spec.kind === 'file') return isTextFile(spec);
  return true;
}

function languageToFilename(language?: string): string {
  if (!language) return 'snippet.txt';
  const normalized = language.toLowerCase();
  if (normalized === 'js' || normalized === 'javascript') return 'snippet.js';
  if (normalized === 'ts' || normalized === 'typescript') return 'snippet.ts';
  if (normalized === 'py' || normalized === 'python') return 'snippet.py';
  if (normalized === 'json') return 'snippet.json';
  if (normalized === 'md' || normalized === 'markdown') return 'snippet.md';
  if (normalized === 'html' || normalized === 'svg') return `snippet.${normalized}`;
  return `snippet.${normalized}`;
}

function loadStoredWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
    const value = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(value) && value >= MIN_DRAWER_WIDTH ? value : DEFAULT_DRAWER_WIDTH;
  } catch {
    return DEFAULT_DRAWER_WIDTH;
  }
}

function formatJsonText(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function ArtifactDrawer({ artifact, fileApi, onClose, hideShare = false }: ArtifactDrawerProps) {
  const canPreview = supportsPreview(artifact);
  const canSource = supportsSource(artifact);
  const [mode, setMode] = useState<ViewMode>(canPreview ? 'preview' : 'source');
  const [copied, setCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [width, setWidth] = useState(loadStoredWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (event: MouseEvent) => {
      const desired = window.innerWidth - event.clientX;
      const max = Math.max(MIN_DRAWER_WIDTH, window.innerWidth - RESERVED_CHAT_WIDTH);
      setWidth(Math.min(Math.max(desired, MIN_DRAWER_WIDTH), max));
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) return;
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
    } catch {
      // ignore
    }
  }, [isDragging, width]);

  useEffect(() => {
    setMode(canPreview ? 'preview' : 'source');
  }, [canPreview, artifact.title]);

  useEffect(() => {
    setShareStatus('idle');
    setShareToast(null);
  }, [artifact.fileId]);

  useEffect(() => {
    if (artifact.kind !== 'file' || (!artifact.fileId && !artifact.contentUrl)) {
      setFileBlobUrl(null);
      setFileText(null);
      setFileError(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    setFileLoading(true);
    setFileError(null);
    setFileBlobUrl(null);
    setFileText(null);

    void fileApi
      .fetchFileBlob({
        fileId: artifact.fileId,
        contentUrl: artifact.contentUrl,
      })
      .then(async (blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setFileBlobUrl(createdUrl);
        if (isTextFile(artifact)) {
          try {
            const text = await blob.text();
            if (!cancelled) setFileText(text);
          } catch {
            // preview may still work via blob url
          }
        }
        setFileLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setFileError(error instanceof Error ? error.message : String(error));
        setFileLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [artifact, artifact.contentType, artifact.contentUrl, artifact.fileId, artifact.fileName, artifact.kind, fileApi]);

  const downloadUrl = useMemo(
    () => artifact.contentUrl ?? (artifact.fileId ? fileApi.getFileContentUrl(artifact.fileId) : null),
    [artifact, fileApi]
  );

  const copyContent = () => {
    if (!artifact.content) return;
    void navigator.clipboard.writeText(artifact.content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDownload = async () => {
    if (!artifact.fileId && !artifact.contentUrl) return;
    try {
      const blob = await fileApi.fetchFileBlob({
        fileId: artifact.fileId,
        contentUrl: artifact.contentUrl,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = artifact.fileName || artifact.title;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('download failed', error);
    }
  };

  const handleShare = async () => {
    if (!artifact.fileId || shareStatus === 'loading') return;
    setShareStatus('loading');
    try {
      const response = await fileApi.share(artifact.fileId);
      const shareUrl = new URL(response.share_url, window.location.origin).toString();
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        window.prompt('Share link', shareUrl);
      }
      setShareStatus('copied');
      setShareToast('Share link copied');
      window.setTimeout(() => setShareStatus('idle'), 1800);
      window.setTimeout(() => setShareToast(null), 2500);
    } catch (error) {
      console.warn('share failed', error);
      setShareStatus('error');
      setShareToast('Share failed');
      window.setTimeout(() => setShareStatus('idle'), 1800);
      window.setTimeout(() => setShareToast(null), 2500);
    }
  };

  const drawerContent = (
    <div
      className="flex flex-col h-full shrink-0 border-l relative"
      style={{
        width: maximized ? '100%' : width,
        borderColor: 'var(--color-border)',
        background: 'var(--color-bg)',
      }}
    >
      {!maximized ? (
        <div
          onMouseDown={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          className="absolute top-0 left-0 h-full z-20"
          style={{ width: 6, marginLeft: -3, cursor: 'col-resize' }}
          title="Drag to resize"
        />
      ) : null}
      {isDragging ? <div className="fixed inset-0 z-50" style={{ cursor: 'col-resize' }} /> : null}

      <div
        className="flex items-center justify-between px-6 py-3 border-b min-h-[61px]"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{
              background: 'var(--color-bg-tertiary)',
              width: 36,
              height: 36,
            }}
          >
            {iconFor(artifact)}
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium truncate block" style={{ color: 'var(--color-text)' }}>
              {artifact.title}
            </span>
            <span className="text-xs truncate block" style={{ color: 'var(--color-text-muted)' }}>
              {artifact.kind.toUpperCase()}
              {artifact.language ? ` · ${artifact.language}` : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {artifact.content ? (
            <button
              type="button"
              onClick={copyContent}
              className="p-1.5 rounded-lg cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
              title={copied ? 'Copied' : 'Copy content'}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          ) : null}
          {downloadUrl ? (
            <button
              type="button"
              onClick={() => void handleDownload()}
              className="p-1.5 rounded-lg cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Download"
            >
              <Download size={14} />
            </button>
          ) : null}
          {!hideShare && artifact.fileId ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => void handleShare()}
                disabled={shareStatus === 'loading'}
                className="p-1.5 rounded-lg cursor-pointer disabled:opacity-70"
                style={{
                  color:
                    shareStatus === 'error'
                      ? 'var(--color-error)'
                      : shareStatus === 'copied'
                        ? 'var(--color-success)'
                        : 'var(--color-text-secondary)',
                }}
                title="Share"
              >
                {shareStatus === 'loading' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : shareStatus === 'copied' ? (
                  <Check size={14} />
                ) : (
                  <Share2 size={14} />
                )}
              </button>
              {shareToast ? (
                <div
                  className="absolute top-full right-0 mt-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shadow-lg z-30"
                  style={{
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {shareToast}
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setMaximized((value) => !value)}
            className="p-1.5 rounded-lg cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }}
            title={maximized ? 'Restore' : 'Maximize'}
          >
            {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }}
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {canPreview && canSource ? (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-bg)',
          }}
        >
          <button
            type="button"
            onClick={() => setMode('preview')}
            className="px-3 py-1 text-xs rounded-md cursor-pointer"
            style={{
              background: mode === 'preview' ? 'var(--color-primary)' + '20' : 'transparent',
              color: mode === 'preview' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            }}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setMode('source')}
            className="px-3 py-1 text-xs rounded-md cursor-pointer"
            style={{
              background: mode === 'source' ? 'var(--color-primary)' + '20' : 'transparent',
              color: mode === 'source' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            }}
          >
            Source
          </button>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto" style={{ background: 'var(--color-bg)' }}>
        {mode === 'preview'
          ? renderPreview(artifact, {
              fileBlobUrl,
              fileText,
              fileError,
              fileLoading,
            })
          : renderSource(artifact, { fileText, fileError, fileLoading })}
      </div>
    </div>
  );

  if (maximized) {
    return createPortal(<div className="fixed inset-0 z-50">{drawerContent}</div>, document.body);
  }

  return drawerContent;
}

function renderPreview(
  spec: ArtifactSpec,
  state: {
    fileBlobUrl: string | null;
    fileText: string | null;
    fileError: string | null;
    fileLoading: boolean;
  }
) {
  if (isJsonCodeArtifact(spec) && spec.content) {
    return (
      <pre
        className="p-6 text-xs font-mono whitespace-pre-wrap"
        style={{ color: 'var(--color-text-secondary)', margin: 0 }}
      >
        {formatJsonText(spec.content)}
      </pre>
    );
  }
  if (spec.kind === 'html' && spec.content) {
    return (
      <iframe sandbox="allow-scripts" srcDoc={spec.content} title={spec.title} className="w-full h-full border-0" />
    );
  }
  if (spec.kind === 'svg' && spec.content) {
    return <div className="p-6 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: spec.content }} />;
  }
  if (spec.kind === 'markdown' && spec.content) {
    return (
      <div className="px-6 py-4 text-sm ai-chat-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{spec.content}</ReactMarkdown>
      </div>
    );
  }
  if (spec.kind === 'file' && (spec.fileId || spec.contentUrl)) {
    if (state.fileLoading) {
      return (
        <div
          className="p-6 flex items-center justify-center gap-2 text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Loader2 size={16} className="animate-spin" /> Loading file...
        </div>
      );
    }
    if (state.fileError) {
      return (
        <div className="p-6 text-sm" style={{ color: 'var(--color-error)' }}>
          Failed to load file: {state.fileError}
        </div>
      );
    }
    if (!state.fileBlobUrl) {
      return (
        <div className="p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No preview available.
        </div>
      );
    }

    const lowerName = spec.fileName?.toLowerCase() ?? '';
    const isImage = spec.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/.test(lowerName);
    const isVideo = spec.contentType?.startsWith('video/') || /\.(mp4|webm|ogv|mov|m4v)$/.test(lowerName);
    const isHtml = spec.contentType === 'text/html' || /\.html?$/.test(lowerName);
    const isMarkdown = spec.contentType === 'text/markdown' || /\.(md|markdown)$/.test(lowerName);
    const isPdf = spec.contentType === 'application/pdf' || /\.pdf$/i.test(lowerName);
    const isJson = isJsonFileArtifact(spec);

    if (isJson && state.fileText != null) {
      return (
        <pre
          className="p-6 text-xs font-mono whitespace-pre-wrap"
          style={{ color: 'var(--color-text-secondary)', margin: 0 }}
        >
          {formatJsonText(state.fileText)}
        </pre>
      );
    }
    if (isImage) {
      return (
        <div className="p-6 flex items-center justify-center">
          <img src={state.fileBlobUrl} alt={spec.title} className="max-w-full max-h-full" />
        </div>
      );
    }
    if (isVideo) {
      return (
        <div className="p-6 flex items-center justify-center">
          <video controls src={state.fileBlobUrl} className="max-w-full max-h-full" />
        </div>
      );
    }
    if (isHtml) {
      return (
        <iframe sandbox="allow-scripts" src={state.fileBlobUrl} title={spec.title} className="w-full h-full border-0" />
      );
    }
    if (isMarkdown && state.fileText != null) {
      return (
        <div className="px-6 py-4 text-sm ai-chat-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.fileText}</ReactMarkdown>
        </div>
      );
    }
    if (isPdf) {
      return <iframe src={state.fileBlobUrl} title={spec.title} className="w-full h-full border-0" />;
    }
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Preview not available for this file type. Use the download button.
      </div>
    );
  }
  return (
    <div className="p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
      No preview available.
    </div>
  );
}

function renderSource(
  spec: ArtifactSpec,
  state: {
    fileText: string | null;
    fileError: string | null;
    fileLoading: boolean;
  }
) {
  if (spec.kind === 'file') {
    if (state.fileLoading) {
      return (
        <div
          className="p-6 flex items-center justify-center gap-2 text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Loader2 size={16} className="animate-spin" /> Loading source...
        </div>
      );
    }
    if (state.fileError) {
      return (
        <div className="p-6 text-sm" style={{ color: 'var(--color-error)' }}>
          Failed to load source: {state.fileError}
        </div>
      );
    }
    if (state.fileText == null) {
      return (
        <div className="p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Source not available for this file type.
        </div>
      );
    }
    return (
      <pre
        className="p-6 text-xs font-mono whitespace-pre-wrap"
        style={{ color: 'var(--color-text-secondary)', margin: 0 }}
      >
        {state.fileText}
      </pre>
    );
  }
  if (spec.content == null) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        No source available.
      </div>
    );
  }
  return (
    <pre
      className="p-6 text-xs font-mono whitespace-pre-wrap"
      style={{ color: 'var(--color-text-secondary)', margin: 0 }}
    >
      {spec.content}
    </pre>
  );
}
