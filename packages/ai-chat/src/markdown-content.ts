// Match parenthetical URLs like (https://...) or （https://...）,
// but skip (https://...) inside markdown links [text](https://...).
const PARENTHETICAL_URL_RE = /(?<![\]])[（(](https?:\/\/[^\s）)<>]+)[）)]/g;

function linkifyParentheticalUrls(segment: string): string {
  return segment.replace(PARENTHETICAL_URL_RE, (_match, url, offset, whole) => {
    const open = whole[offset] ?? '(';
    const close = open === '（' ? '）' : ')';
    return `${open}[${url}](${url})${close}`;
  });
}

function preprocessMarkdownSegment(segment: string): string {
  return segment
    .split(/(`[^`\n]+`)/g)
    .map((part) => (part.startsWith('`') && part.endsWith('`') ? part : linkifyParentheticalUrls(part)))
    .join('');
}

/** Normalize agent markdown before rendering (linkify parenthetical URLs, etc.). */
export function prepareAgentMarkdown(content: string): string {
  return content
    .split(/(```[\s\S]*?```)/g)
    .map((part) => (part.startsWith('```') ? part : preprocessMarkdownSegment(part)))
    .join('');
}
