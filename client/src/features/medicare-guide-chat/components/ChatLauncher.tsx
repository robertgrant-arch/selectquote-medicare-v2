import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Collapsed floating launcher. */
export function ChatLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="Open Medicare Guide chat"
      aria-expanded={false}
      className={cn(
        'fixed bottom-4 right-4 z-[9999] flex size-14 items-center justify-center rounded-full',
        'bg-primary text-primary-foreground shadow-lg transition-transform duration-150',
        'hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'duration-200 animate-in fade-in zoom-in-90 motion-reduce:animate-none',
        'md:bottom-6 md:right-6'
      )}
    >
      <MessageCircle className="size-6" />
    </button>
  );
}
