import type { SessionArtifact } from '@connexup/ai-api';
import type { ChatMessage } from './chat-state';

export function extractSessionArtifactsFromToolResult(result?: string): SessionArtifact[] {
  if (!result) return [];
  try {
    const parsed = JSON.parse(result) as {
      submitted?: Array<{
        file_id?: string;
        file_name?: string;
        path?: string;
        content_type?: string;
        size?: number;
        title?: string;
      }>;
    };
    const submitted = Array.isArray(parsed?.submitted) ? parsed.submitted : [];
    return submitted
      .filter((item) => item?.file_id)
      .map((item) => ({
        file_id: item.file_id!,
        file_name: item.file_name || item.path || item.file_id!,
        content_type: item.content_type,
        size: item.size,
        title: item.title,
      }));
  } catch {
    return [];
  }
}

export function mergeSessionArtifacts(current: SessionArtifact[], additions: SessionArtifact[]): SessionArtifact[] {
  if (additions.length === 0) return current;
  const seen = new Set(current.map((artifact) => artifact.file_id));
  const merged = [...current];
  for (const artifact of additions) {
    if (!seen.has(artifact.file_id)) {
      seen.add(artifact.file_id);
      merged.push(artifact);
    }
  }
  return merged;
}

export function getMessageArtifacts(message: ChatMessage, sessionArtifacts: SessionArtifact[]): SessionArtifact[] {
  const fileIds = new Set<string>();
  for (const segment of message.segments) {
    if (segment.type !== 'tools') continue;
    for (const tool of segment.tools) {
      if (tool.tool === 'submit_artifacts' && tool.type === 'result' && tool.result) {
        for (const artifact of extractSessionArtifactsFromToolResult(tool.result)) {
          fileIds.add(artifact.file_id);
        }
      }
    }
  }
  if (fileIds.size === 0) return [];
  return sessionArtifacts.filter((artifact) => fileIds.has(artifact.file_id));
}
