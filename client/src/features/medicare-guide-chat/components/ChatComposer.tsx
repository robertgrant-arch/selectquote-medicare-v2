import { RefObject } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_INPUT_LENGTH } from '../lib/chatConstants';

/** Input controls: bounded text field + send action. */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="flex items-center gap-2 border-t border-border px-4 py-3"
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about Medicare plans..."
        disabled={disabled}
        maxLength={MAX_INPUT_LENGTH}
        aria-label="Message Medicare Guide"
        className={cn(
          'flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground',
          'outline-none placeholder:text-muted-foreground',
          'focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
        )}
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="size-9 shrink-0 rounded-full"
      >
        <Send className="size-4" />
      </Button>
    </form>
  );
}
