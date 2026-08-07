export type ArtifactKind = 'html' | 'svg' | 'code' | 'markdown' | 'file';

export interface ArtifactSpec {
  kind: ArtifactKind;
  title: string;
  content?: string;
  language?: string;
  fileId?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  contentUrl?: string;
}

export function summarizeArtifact(spec: ArtifactSpec): string {
  if (spec.kind === 'file') {
    const parts: string[] = [];
    if (spec.contentType) parts.push(spec.contentType);
    if (typeof spec.size === 'number') parts.push(formatBytes(spec.size));
    return parts.join(' · ') || 'File';
  }
  const chars = spec.content?.length ?? 0;
  const lines = spec.content ? spec.content.split('\n').length : 0;
  const lang = spec.language ? `${spec.language} · ` : '';
  return `${lang}${lines} lines · ${chars} chars`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
