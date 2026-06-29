import { memo } from 'react';
import { Stethoscope, AlertCircle, RotateCw, ChevronRight, ArrowRight, Star } from 'lucide-react';
import { Link } from 'wouter';
import { RichText } from '../lib/richText';
import type { RecommendationHandoff } from '../types/chat';

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

// Rendered inside the message bubble, flush to the bubble edges via negative margins.
// The divider line connects the bot's text to the plan details + CTA as one visual unit.
function EmbeddedRecommendation({ recommendation }: { recommendation: RecommendationHandoff }) {
  const multi = recommendation.plans.length > 1;
  return (
    <div className="-mx-4 -mb-2.5 mt-3 border-t border-border/50">
      <div className="px-4 pb-3 pt-3">
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-primary/80">
          {multi ? 'Best-fit options' : 'Best-fit option'}
        </p>
        <div className="mb-3 space-y-2.5">
          {recommendation.plans.map((plan) => (
            <div key={plan.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-snug text-foreground">
                  {plan.carrier} {plan.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {plan.type}
                  {plan.premium === 0 ? ' · $0/mo' : ` · $${plan.premium}/mo`}
                  {plan.stars ? ` · ${plan.stars}★` : ''}
                </p>
              </div>
              {plan.stars && plan.stars >= 4 && (
                <Star className="mt-0.5 size-3.5 shrink-0 fill-amber-400 text-amber-400" />
              )}
            </div>
          ))}
        </div>
        <Link
          href={recommendation.ctaHref}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {recommendation.ctaLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
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
  cta,
  recommendation,
  onRetry,
  onChipClick,
}: {
  content: string;
  error?: boolean;
  streaming?: boolean;
  chips?: string[];
  cta?: { label: string; href: string };
  recommendation?: RecommendationHandoff;
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
        {/* Plan card embedded inside the bubble so text + card read as one message */}
        {!streaming && recommendation && (
          <EmbeddedRecommendation recommendation={recommendation} />
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
      {!streaming && !recommendation && cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {cta.label}
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
});
