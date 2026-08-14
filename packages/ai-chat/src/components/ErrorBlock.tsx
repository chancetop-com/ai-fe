export interface ErrorBlockProps {
  message: string;
  detail?: string;
  errorCode?: string;
}

function colorMix(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, var(--color-border))`;
}

export function ErrorBlock({ message, detail, errorCode }: ErrorBlockProps) {
  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm"
      style={{
        borderColor: colorMix('var(--color-error)', 30),
        background: colorMix('var(--color-error)', 10),
        color: 'var(--color-error)',
      }}
    >
      Error:
      {errorCode ? <div className="text-xs font-medium mb-1 opacity-80">{errorCode}</div> : null}
      <div className="whitespace-pre-wrap font-medium">{message}</div>
      {detail ? <div className="text-xs mt-1 opacity-80 whitespace-pre-wrap">{detail}</div> : null}
    </div>
  );
}
