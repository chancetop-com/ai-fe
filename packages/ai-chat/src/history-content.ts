import type { SendMessageAttachment } from '@connexup/ai-api';

const SANDBOX_FILE_RE = /\[File uploaded to sandbox:\s*([^\]]+)\]/gi;
const STANDALONE_URL_LINE_RE = /^https?:\/\/\S+$/i;

export interface ParsedHistoryAttachment {
  url: string;
  type: string;
  file_name?: string;
  content_type?: string;
}

export interface ParsedHistoryContent {
  text: string;
  attachments: ParsedHistoryAttachment[];
}

function extensionFromPath(path: string): string | undefined {
  const base = path.split('/').pop()?.split('?')[0] ?? path;
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : undefined;
}

function inferAttachmentType(fileName?: string, url?: string): string {
  const ext = extensionFromPath(fileName ?? url ?? '');
  if (!ext) return 'FILE';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'IMAGE';
  if (ext === 'pdf') return 'PDF';
  if (['mp4', 'webm', 'ogv', 'mov', 'm4v'].includes(ext)) return 'VIDEO';
  return 'FILE';
}

function toChatAttachmentFromUrl(url: string): ParsedHistoryAttachment {
  const file_name = url.split('/').pop()?.split('?')[0];
  return {
    url,
    type: inferAttachmentType(file_name, url),
    file_name,
  };
}

function toChatAttachmentFromSend(attachment: SendMessageAttachment): ParsedHistoryAttachment | null {
  if (!attachment.url) return null;
  return {
    url: attachment.url,
    type: attachment.type || inferAttachmentType(attachment.file_name, attachment.url),
    file_name: attachment.file_name,
    content_type: attachment.content_type,
  };
}

function parseMetadataAttachments(metadata?: Record<string, string>): ParsedHistoryAttachment[] {
  if (!metadata) return [];

  const raw = (metadata as Record<string, unknown>).attachments;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item): item is SendMessageAttachment => Boolean(item && typeof item === 'object' && 'url' in item))
    .map(toChatAttachmentFromSend)
    .filter((item): item is ParsedHistoryAttachment => item !== null);
}

export function parseHistoryMessageContent(
  content: string,
  options?: {
    explicitAttachments?: SendMessageAttachment[];
    metadata?: Record<string, string>;
  }
): ParsedHistoryContent {
  const attachments: ParsedHistoryAttachment[] = [];
  const seen = new Set<string>();

  const addAttachment = (attachment: ParsedHistoryAttachment) => {
    const key = attachment.url || attachment.file_name || '';
    if (!key || seen.has(key)) return;
    seen.add(key);
    attachments.push(attachment);
  };

  for (const attachment of options?.explicitAttachments ?? []) {
    const mapped = toChatAttachmentFromSend(attachment);
    if (mapped) addAttachment(mapped);
  }
  for (const attachment of parseMetadataAttachments(options?.metadata)) {
    addAttachment(attachment);
  }

  let text = content;

  text = text.replace(SANDBOX_FILE_RE, (_, rawPath: string) => {
    const path = rawPath.trim();
    const file_name = path.split('/').pop() || path;
    addAttachment({
      url: '',
      type: inferAttachmentType(file_name),
      file_name,
    });
    return '';
  });

  const keptLines: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (STANDALONE_URL_LINE_RE.test(trimmed)) {
      addAttachment(toChatAttachmentFromUrl(trimmed));
      continue;
    }
    keptLines.push(line);
  }

  const normalizedText = keptLines
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text: normalizedText, attachments };
}
