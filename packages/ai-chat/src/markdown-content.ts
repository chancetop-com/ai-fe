// RFC 3986–style URL characters only; stop before spaces, CJK, and full-width punctuation.
const URL_BODY_RE = String.raw`[\w\-._~:/?#[\]@!$&'()*+,;=%]+`;

// Match parenthetical URLs like (https://...) or （https://...）,
// but skip (https://...) inside markdown links [text](https://...).
const PARENTHETICAL_URL_RE = new RegExp(
  String.raw`(?<![\]])[（(](https?:\/\/${URL_BODY_RE})[）)]`,
  'g'
);

// Bare http(s) URLs in prose (history / agent text), not already in [text](url).
const BARE_URL_RE = new RegExp(String.raw`(?<!\]\()(?<![(\[])(https?:\/\/${URL_BODY_RE})`, 'g');

// Trailing ASCII punctuation sometimes glued to a URL (e.g. "https://x.com).")
const TRAILING_ASCII_URL_PUNCTUATION_RE = /[.,;:!?)]+$/;

function trimTrailingAsciiUrlPunctuation(url: string): string {
  return url.replace(TRAILING_ASCII_URL_PUNCTUATION_RE, '');
}

function linkifyParentheticalUrls(segment: string): string {
  return segment.replace(PARENTHETICAL_URL_RE, (_match, url, offset, whole) => {
    const open = whole[offset] ?? '(';
    const close = open === '（' ? '）' : ')';
    const href = trimTrailingAsciiUrlPunctuation(url);
    if (!href) return _match;
    return `${open}[${href}](${href})${close}`;
  });
}

function linkifyBareUrls(segment: string): string {
  return segment.replace(BARE_URL_RE, (match) => {
    const url = trimTrailingAsciiUrlPunctuation(match);
    if (!url || url.length <= 'https://'.length) return match;
    return `[${url}](${url})`;
  });
}

function preprocessMarkdownSegment(segment: string): string {
  return segment
    .split(/(`[^`\n]+`)/g)
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`')) return part;
      return linkifyBareUrls(linkifyParentheticalUrls(part));
    })
    .join('');
}

/** Normalize agent markdown before rendering (linkify parenthetical URLs, etc.). */
export function prepareAgentMarkdown(content: string): string {
  return content
    .split(/(```[\s\S]*?```)/g)
    .map((part) => (part.startsWith('```') ? part : preprocessMarkdownSegment(part)))
    .join('');
}
