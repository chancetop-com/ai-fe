import { resolveStreamErrorMessage } from '../stream-error-messages';

export interface ErrorBlockProps {
  message: string;
  detail?: string;
  errorCode?: string;
}

function colorMix(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, var(--color-border))`;
}

export function ErrorBlock({ message, detail, errorCode }: ErrorBlockProps) {
  const displayMessage = resolveStreamErrorMessage(errorCode, message);

  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm"
      style={{
        borderColor: colorMix('var(--color-error)', 30),
        background: colorMix('var(--color-error)', 10),
        color: 'var(--color-error)',
      }}
    >
      <div className="whitespace-pre-wrap font-medium">{displayMessage}</div>
    </div>
  );
}
