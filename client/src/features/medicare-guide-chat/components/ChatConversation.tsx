import { RefObject } from 'react';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '../types/chat';
import { groupMessages } from '../lib/messageGroups';
import { AssistantGlyph, AssistantMessage, UserMessage } from './MessageBubble';

/**
 * Scrollable conversation: groups consecutive same-role turns, renders bubbles,
 * intro quick-replies, and the "new messages" pill. Pure view — all state and
 * handlers come from the container via props.
 */
export function ChatConversation({
  messages,
  isLoading,
  showScrollPill,
  scrollRef,
  onScroll,
  onScrollToBottom,
  onRetry,
  onSendPrompt,
}: {
  messages: Message[];
  isLoading: boolean;
  showScrollPill: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onScrollToBottom: (smooth?: boolean) => void;
  onRetry: () => void;
  onSendPrompt: (prompt: string) => void;
}) {
  const groups = groupMessages(messages);
  const lastIndex = messages.length - 1;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="h-full overflow-y-auto px-4 py-4"
      >
        <div className="flex flex-col gap-5">
          {groups.map((group, gi) =>
            group.role === 'assistant' ? (
              <div key={gi} className="flex gap-2.5">
                <AssistantGlyph />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                  {group.items.map(({ msg, index }) => (
                    <AssistantMessage
                      key={index}
                      content={msg.content}
                      error={msg.error}
                      streaming={isLoading && index === lastIndex && msg.content !== ''}
                      chips={msg.chips}
                      cta={msg.cta}
                      recommendation={msg.recommendation}
                      onRetry={onRetry}
                      onChipClick={onSendPrompt}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div key={gi} className="flex flex-col items-end gap-1.5 pl-10">
                {group.items.map(({ msg, index }) => (
                  <UserMessage key={index} content={msg.content} />
                ))}
              </div>
            )
          )}

        </div>
      </div>

      {showScrollPill && (
        <button
          onClick={() => onScrollToBottom(true)}
          className={cn(
            'absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full',
            'border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-md',
            'transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <ArrowDown className="size-3.5" />
          New messages
        </button>
      )}
    </div>
  );
}
