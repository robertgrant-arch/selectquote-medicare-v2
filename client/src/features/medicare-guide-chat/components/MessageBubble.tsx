import { memo } from 'react';
import { Stethoscope, AlertCircle, RotateCw, ChevronRight } from 'lucide-react';
import { RichText } from '../lib/richText';

/** Small assistant identity glyph, shown once per assistant turn-group. */
export function AssistantGlyph() {
  return (
    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
      <Stethoscope className="size-4 text-primary" />
    </div>
  );
}

/** Calm three-dot indicator shown before the first streamed token arrives. */
export function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5" aria-label="Medicare Guide is typing">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms] motion-reduce:animate-none" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms] motion-reduce:animate-none" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms] motion-reduce:animate-none" />
    </div>
  );
}

export function UserMessage({ content }: { content: string }) {
  return (
    <div className="w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
      {content}
    </div>
  );
}

/**
 * Memoized assistant bubble: a turn only re-renders when its own
 * content/error/streaming changes, so streaming re-renders the live bubble —
 * not every prior message — keeping long conversations responsive.
 */
export const AssistantMessage = memo(function AssistantMessage({
  content,
  error,
  streaming,
  chips,
  onRetry,
  onChipClick,
}: {
  content: string;
  error?: boolean;
  streaming?: boolean;
  chips?: string[];
  onRetry: () => void;
  onChipClick?: (chip: string) => void;
}) {
  if (error) {
    return (
      <div className="w-full max-w-full rounded-2xl rounded-bl-sm border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-foreground">
        <div className="flex gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-2"><RichText text={content} /></div>
        </div>
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCw className="size-3.5" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="w-fit max-w-full space-y-2">
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground">
        {content ? (
          <>
            <RichText text={content} />
            {streaming && (
              <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground/70 motion-reduce:animate-none" />
            )}
          </>
        ) : (
          <TypingDots />
        )}
      </div>
      {!streaming && chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => onChipClick?.(chip)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="size-3" />
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
