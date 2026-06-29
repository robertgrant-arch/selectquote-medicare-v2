import { cn } from '@/lib/utils';
import { useChatSession } from './hooks/useChatSession';
import { ChatLauncher } from './components/ChatLauncher';
import { ChatHeader } from './components/ChatHeader';
import { ChatConversation } from './components/ChatConversation';
import { ChatComposer } from './components/ChatComposer';

/**
 * Container / orchestration for the Medicare Guide chat slice. Wires the
 * session hook to the view components and the launcher/panel shell. Holds no
 * conversation logic of its own.
 */
export function MedicareGuideChat() {
  const {
    isOpen,
    setIsOpen,
    messages,
    input,
    setInput,
    isLoading,
    showScrollPill,
    scrollRef,
    inputRef,
    handleScroll,
    scrollToBottom,
    send,
    retry,
  } = useChatSession();

  if (!isOpen) {
    return <ChatLauncher onOpen={() => setIsOpen(true)} />;
  }

  return (
    <div
      role="dialog"
      aria-label="Medicare Guide chat"
      className={cn(
        'fixed z-[9999] flex flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-2xl',
        // Quiet entrance: mobile slides up from the bottom; desktop fades/scales
        // in from the corner. ≤200ms, reduced-motion safe (per UX spec).
        // Layout switch uses md (768px) to match the app's useIsMobile breakpoint.
        'duration-200 animate-in fade-in slide-in-from-bottom-4 md:zoom-in-95 md:slide-in-from-bottom-0 motion-reduce:animate-none',
        'inset-x-0 bottom-0 h-[100dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
        'md:inset-auto md:bottom-6 md:right-6 md:h-[640px] md:max-h-[calc(100vh-3rem)] md:w-[400px] md:rounded-2xl md:pb-0'
      )}
    >
      <ChatHeader onClose={() => setIsOpen(false)} />

      <ChatConversation
        messages={messages}
        isLoading={isLoading}
        showScrollPill={showScrollPill}
        scrollRef={scrollRef}
        onScroll={handleScroll}
        onScrollToBottom={scrollToBottom}
        onRetry={retry}
        onSendPrompt={send}
      />

      <ChatComposer
        value={input}
        onChange={setInput}
        onSubmit={() => send(input)}
        disabled={isLoading}
        inputRef={inputRef}
      />

      <p className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
        AI assistant · Not a licensed agent ·{' '}
        <a href="tel:1-800-777-8002" className="text-primary hover:underline">1-800-777-8002</a>
      </p>
    </div>
  );
}
