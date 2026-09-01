import type { ComponentProps } from 'react';
import type ReactMarkdown from 'react-markdown';

type MarkdownComponents = NonNullable<ComponentProps<typeof ReactMarkdown>['components']>;

export const defaultMarkdownComponents: MarkdownComponents = {
  a({ href, children, node: _node, className, ...props }) {
    if (!href) {
      return <span className={className}>{children}</span>;
    }

    return (
      <a
        {...props}
        href={href}
        className={['ai-chat-markdown-link', className].filter(Boolean).join(' ')}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
};

export function mergeMarkdownComponents(
  base: MarkdownComponents,
  overrides?: MarkdownComponents
): MarkdownComponents {
  if (!overrides) return base;
  return { ...base, ...overrides };
}
