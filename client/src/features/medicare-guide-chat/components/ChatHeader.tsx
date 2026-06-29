import { Stethoscope, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Panel header: brand mark, assistant identity, close control. */
export function ChatHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Stethoscope className="size-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-foreground">Medicare Guide</p>
        <p className="text-xs text-muted-foreground">SelectQuote AI assistant</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Close chat"
        className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </Button>
    </header>
  );
}
