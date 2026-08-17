import type { BlobUploadCategory, SendMessageAttachment } from '@connexup/ai-api';

export interface ComposerAttachment {
  url: string;
  type: 'PDF' | 'IMAGE' | 'FILE' | 'VIDEO';
  file_name?: string;
  content_type?: string;
  category?: string;
  container?: string;
  blob_name?: string;
}

const VALID_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'application/xml',
  'text/xml',
  'text/yaml',
  'application/x-yaml',
  'application/zip',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
]);

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  xml: 'text/xml',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  zip: 'application/zip',
  tar: 'application/x-tar',
  gz: 'application/gzip',
};

export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
export const MAX_VIDEO_ATTACHMENT_SIZE = 2000 * 1024 * 1024;

export function resolveFileType(file: File): string {
  if (!file.type || file.type === 'application/octet-stream') {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const inferred = EXTENSION_MIME_TYPES[extension];
    if (inferred) return inferred;
  }
  return file.type;
}

export function isValidAttachmentType(contentType: string): boolean {
  return VALID_ATTACHMENT_TYPES.has(contentType);
}

export function resolveUploadCategory(contentType: string): BlobUploadCategory {
  const isVideo = contentType.startsWith('video/');
  const isMultimodal = contentType.startsWith('image/') || contentType === 'application/pdf' || isVideo;
  return isMultimodal ? 'multimodal' : 'sandbox';
}

export function mapAttachmentType(contentType: string): ComposerAttachment['type'] {
  if (contentType === 'application/pdf') return 'PDF';
  if (contentType.startsWith('image/')) return 'IMAGE';
  if (contentType.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}

export function isImageAttachment(attachment: {
  type?: string;
  content_type?: string;
  file_name?: string;
  url?: string;
}): boolean {
  if (attachment.type?.toUpperCase() === 'IMAGE') return true;
  if (attachment.content_type?.startsWith('image/')) return true;
  const name = attachment.file_name?.toLowerCase() ?? attachment.url?.toLowerCase() ?? '';
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?|$)/.test(name);
}

export function toSendMessageAttachments(attachments: ComposerAttachment[]): SendMessageAttachment[] {
  return attachments.map((attachment) => ({
    url: attachment.url,
    type: attachment.type,
    file_name: attachment.file_name,
    content_type: attachment.content_type,
    category: attachment.category,
    container: attachment.container,
    blob_name: attachment.blob_name,
  }));
}

export function formatAttachmentSizeLimit(contentType: string): string {
  return contentType.startsWith('video/') ? '2 GB' : '20 MB';
}

export function getAttachmentSizeLimit(contentType: string): number {
  return contentType.startsWith('video/') ? MAX_VIDEO_ATTACHMENT_SIZE : MAX_ATTACHMENT_SIZE;
}
