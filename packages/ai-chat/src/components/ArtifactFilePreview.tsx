import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { defaultMarkdownComponents } from '../markdown-components';
import { prepareAgentMarkdown } from '../markdown-content';

const TEXT_EXT_RE =
  /\.(html?|css|js|jsx|ts|tsx|mjs|json|md|markdown|txt|xml|svg|py|java|kt|go|rb|rs|sh|bash|yaml|yml|toml|csv|tsv|sql|conf|ini|log)$/i;

export interface ArtifactFilePreviewProps {
  fileBlob: Blob | null;
  fileName?: string;
  contentType?: string;
  title?: string;
  loading?: boolean;
  error?: string | null;
}

function formatJsonText(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function isJsonFile(contentType?: string, fileName?: string): boolean {
  const normalizedType = contentType?.toLowerCase() ?? '';
  if (normalizedType.includes('json')) return true;
  return Boolean(fileName && /\.json$/i.test(fileName));
}

function isTextFile(contentType?: string, fileName?: string): boolean {
  const normalizedType = contentType?.toLowerCase();
  if (normalizedType) {
    if (normalizedType.startsWith('text/')) return true;
    if (
      normalizedType.includes('json') ||
      normalizedType.includes('xml') ||
      normalizedType.includes('javascript') ||
      normalizedType.includes('yaml')
    ) {
      return true;
    }
  }
  if (fileName && TEXT_EXT_RE.test(fileName)) return true;
  return false;
}

function PreviewScroll({ children }: { children: ReactNode }) {
  return <div className="ai-chat-artifact-preview-scroll">{children}</div>;
}

function PreviewIframe({
  title,
  src,
  srcDoc,
  sandbox,
}: {
  title: string;
  src?: string;
  srcDoc?: string;
  sandbox?: string;
}) {
  return (
    <div className="ai-chat-artifact-preview-frame">
      <iframe
        title={title}
        src={src}
        srcDoc={srcDoc}
        sandbox={sandbox}
        className="ai-chat-artifact-preview-iframe"
      />
    </div>
  );
}

export function ArtifactFilePreview({
  fileBlob,
  fileName,
  contentType,
  title = 'Shared file',
  loading = false,
  error = null,
}: ArtifactFilePreviewProps) {
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);

  const resolvedContentType = contentType || fileBlob?.type || undefined;

  useEffect(() => {
    if (!fileBlob) {
      setFileBlobUrl(null);
      setFileText(null);
      return;
    }

    const createdUrl = URL.createObjectURL(fileBlob);
    setFileBlobUrl(createdUrl);

    if (isTextFile(resolvedContentType, fileName)) {
      void fileBlob.text().then(setFileText).catch(() => {
        setFileText(null);
      });
    } else {
      setFileText(null);
    }

    return () => {
      URL.revokeObjectURL(createdUrl);
    };
  }, [fileBlob, fileName, resolvedContentType]);

  const preparedMarkdown = useMemo(
    () => (fileText ? prepareAgentMarkdown(fileText) : ''),
    [fileText]
  );

  if (loading) {
    return (
      <div
        className="p-6 flex flex-1 items-center justify-center gap-2 text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <Loader2 size={16} className="animate-spin" /> Loading file...
      </div>
    );
  }

  if (error) {
    return (
      <PreviewScroll>
        <div className="p-6 text-sm" style={{ color: 'var(--color-error)' }}>
          Failed to load file: {error}
        </div>
      </PreviewScroll>
    );
  }

  if (!fileBlobUrl) {
    return (
      <PreviewScroll>
        <div className="p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No preview available.
        </div>
      </PreviewScroll>
    );
  }

  const lowerName = fileName?.toLowerCase() ?? '';
  const isImage =
    resolvedContentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/.test(lowerName);
  const isVideo =
    resolvedContentType?.startsWith('video/') || /\.(mp4|webm|ogv|mov|m4v)$/.test(lowerName);
  const isHtml = resolvedContentType === 'text/html' || /\.html?$/.test(lowerName);
  const isMarkdown = resolvedContentType === 'text/markdown' || /\.(md|markdown)$/.test(lowerName);
  const isPdf = resolvedContentType === 'application/pdf' || /\.pdf$/i.test(lowerName);
  const isJson = isJsonFile(resolvedContentType, fileName);

  if (isJson && fileText != null) {
    return (
      <PreviewScroll>
        <pre
          className="p-6 text-xs font-mono whitespace-pre-wrap"
          style={{ color: 'var(--color-text-secondary)', margin: 0 }}
        >
          {formatJsonText(fileText)}
        </pre>
      </PreviewScroll>
    );
  }

  if (isImage) {
    return (
      <PreviewScroll>
        <div className="p-6 flex min-h-full items-center justify-center">
          <img src={fileBlobUrl} alt={title} className="max-w-full max-h-full object-contain" />
        </div>
      </PreviewScroll>
    );
  }

  if (isVideo) {
    return (
      <PreviewScroll>
        <div className="p-6 flex min-h-full items-center justify-center">
          <video controls src={fileBlobUrl} className="max-w-full max-h-full" />
        </div>
      </PreviewScroll>
    );
  }

  if (isHtml) {
    return <PreviewIframe title={title} src={fileBlobUrl} sandbox="allow-scripts" />;
  }

  if (isMarkdown && fileText != null) {
    return (
      <PreviewScroll>
        <div className="px-6 py-4 text-sm ai-chat-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={defaultMarkdownComponents}>
            {preparedMarkdown}
          </ReactMarkdown>
        </div>
      </PreviewScroll>
    );
  }

  if (isPdf) {
    return <PreviewIframe title={title} src={fileBlobUrl} />;
  }

  return (
    <PreviewScroll>
      <div className="p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Preview not available for this file type. Use the download button.
      </div>
    </PreviewScroll>
  );
}
