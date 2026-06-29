import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { tokenizeInline, splitMessageBlocks, type InlineToken } from './messageFormat';

/**
 * Presentational layer for chat messages. All parsing lives in messageFormat.ts
 * (pure, unit-tested); this file only maps the parsed structure to JSX. The
 * renderer intentionally linkifies in-product deep links (e.g. /plans?zip=…) —
 * it is chat-specific, not a general markdown component.
 */

function renderTokens(tokens: InlineToken[], keyPrefix: string): ReactNode[] {
  return tokens.map((token, i) => {
    const key = `${keyPrefix}-${i}`;
    if (token.kind === 'link') {
      return (
        <a
          key={key}
          href={token.href}
          className={cn(
            'text-primary underline underline-offset-2 hover:text-primary/80',
            token.strong ? 'font-semibold' : 'font-medium'
          )}
          target={token.external ? '_blank' : '_self'}
          rel="noopener noreferrer"
        >
          {token.label}
        </a>
      );
    }
    if (token.kind === 'bold') {
      return <strong key={key} className="font-semibold">{token.value}</strong>;
    }
    return <span key={key}>{token.value}</span>;
  });
}

export function RichText({ text }: { text: string }) {
  const blocks = splitMessageBlocks(text);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.kind === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((it, j) => <li key={j}>{renderTokens(tokenizeInline(it), `ul${i}-${j}`)}</li>)}
            </ul>
          );
        }
        if (block.kind === 'ol') {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {block.items.map((it, j) => <li key={j}>{renderTokens(tokenizeInline(it), `ol${i}-${j}`)}</li>)}
            </ol>
          );
        }
        return <p key={i}>{renderTokens(tokenizeInline(block.text), `p${i}`)}</p>;
      })}
    </div>
  );
}
